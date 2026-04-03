const express = require('express');

const Instance = require('../models/Instance');
const LoadBalancer = require('../models/LoadBalancer');
const RouteTable = require('../models/RouteTable');
const VPC = require('../models/VPC');
const auth = require('../middleware/auth');

const router = express.Router();
const LB_STATUS = {
  ACTIVE: 'active',
  PROVISIONING: 'provisioning',
  FAILED: 'failed'
};

function normalizeText(value = '') {
  return String(value).trim();
}

function slugify(value = '') {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function longToIp(longValue) {
  return [24, 16, 8, 0]
    .map((shift) => (longValue >>> shift) & 255)
    .join('.');
}

function ipToLong(ip) {
  const octets = String(ip)
    .split('.')
    .map((segment) => Number.parseInt(segment, 10));

  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    throw new Error('Invalid IPv4 address');
  }

  return octets.reduce((result, octet) => ((result << 8) + octet) >>> 0, 0);
}

function parseCidr(cidr) {
  const normalized = normalizeText(cidr);
  const [ip, prefixRaw] = normalized.split('/');
  const prefix = Number.parseInt(prefixRaw, 10);

  if (!ip || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    throw new Error('Invalid CIDR block');
  }

  const baseIp = ipToLong(ip);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const start = (baseIp & mask) >>> 0;
  const size = 2 ** (32 - prefix);
  const end = start + size - 1;

  return {
    cidr: normalized,
    prefix,
    start,
    end
  };
}

function assertValidCidr(cidr, label) {
  try {
    return parseCidr(cidr);
  } catch (_error) {
    throw new Error(`${label} must be a valid IPv4 CIDR block like 10.0.0.0/16`);
  }
}

function cidrContains(parentCidr, childCidr) {
  const parent = parseCidr(parentCidr);
  const child = parseCidr(childCidr);
  return child.start >= parent.start && child.end <= parent.end;
}

function cidrsOverlap(firstCidr, secondCidr) {
  const first = parseCidr(firstCidr);
  const second = parseCidr(secondCidr);
  return !(first.end < second.start || second.end < first.start);
}

function deriveSubnetCidr(vpcCidr, index = 0) {
  const parsedVpc = parseCidr(vpcCidr);
  const subnetPrefix = parsedVpc.prefix >= 24 ? parsedVpc.prefix : 24;
  const subnetSize = 2 ** (32 - subnetPrefix);
  const candidateStart = parsedVpc.start + (index * subnetSize);
  const subnetStart = candidateStart <= parsedVpc.end ? candidateStart : parsedVpc.start;
  return `${longToIp(subnetStart)}/${subnetPrefix}`;
}

function buildLocalRoute(cidr) {
  return {
    destination: cidr,
    target: 'local',
    targetType: 'local'
  };
}

function sanitizeCustomRoutes(routes = [], vpcCidr) {
  const normalizedRoutes = [buildLocalRoute(vpcCidr)];

  routes.forEach((route) => {
    const destination = normalizeText(route?.destination);
    const target = normalizeText(route?.target);
    const targetType = ['local', 'internet-gateway', 'nat-gateway', 'vpc-peering', 'custom'].includes(
      normalizeText(route?.targetType)
    )
      ? normalizeText(route?.targetType)
      : 'custom';

    if (!destination && !target) {
      return;
    }

    if (!destination || !target) {
      throw new Error('Each custom route must include both destination and target');
    }

    assertValidCidr(destination, 'Route destination');

    if (destination === vpcCidr && targetType === 'local') {
      return;
    }

    normalizedRoutes.push({
      destination,
      target,
      targetType
    });
  });

  return normalizedRoutes;
}

async function findVpcForUser(userId, vpcId) {
  return VPC.findOne({ _id: vpcId, user: userId });
}

function mapSubnetAssociations(vpc, subnetIds = []) {
  const uniqueSubnetIds = [...new Set(subnetIds)];

  return uniqueSubnetIds.map((subnetId) => {
    const subnet = vpc.subnets.id(subnetId);

    if (!subnet) {
      throw new Error(`Subnet ${subnetId} was not found in the selected VPC`);
    }

    return {
      subnetId: subnet._id.toString(),
      subnetName: subnet.name,
      cidr: subnet.cidr
    };
  });
}

async function ensureMainRouteTableForVpc(userId, vpc) {
  let mainRouteTable = await RouteTable.findOne({
    user: userId,
    vpc: vpc._id,
    isMain: true
  });

  if (mainRouteTable) {
    return mainRouteTable;
  }

  mainRouteTable = new RouteTable({
    user: userId,
    vpc: vpc._id,
    name: `${vpc.name}-main`,
    isMain: true,
    routes: sanitizeCustomRoutes([], vpc.cidr),
    associatedSubnets: (vpc.subnets || []).map((subnet) => ({
      subnetId: subnet._id.toString(),
      subnetName: subnet.name,
      cidr: subnet.cidr
    }))
  });

  await mainRouteTable.save();
  return mainRouteTable;
}

function serializeInstanceTarget(instance) {
  return {
    _id: instance._id.toString(),
    name: instance.name,
    ip: instance.privateIp || instance.ip || '',
    publicIp: instance.ip || '',
    privateIp: instance.privateIp || '',
    region: instance.region || 'us-east-1',
    status: instance.status,
    vpcId: instance.vpcId ? instance.vpcId.toString() : '',
    vpcName: instance.vpcName || '',
    subnetId: instance.subnetId || '',
    subnetName: instance.subnetName || '',
    securityGroup: instance.securityGroup || 'default'
  };
}

function buildLoadBalancerTargets(instances, listenerPort) {
  return instances.map((instance) => ({
    instance: instance._id,
    port: listenerPort,
    healthStatus: instance.status === 'running' ? 'healthy' : 'unhealthy'
  }));
}

function computeLoadBalancerStatus(targets = []) {
  if (!targets.length) {
    return LB_STATUS.PROVISIONING;
  }

  return targets.some((target) => target.healthStatus === 'healthy')
    ? LB_STATUS.ACTIVE
    : LB_STATUS.FAILED;
}

function createLoadBalancerDnsName(name, region, userId) {
  const baseName = slugify(name) || 'lb';
  return `${baseName}-${String(userId).slice(-6)}.${region}.elb.bytesky.local`;
}

function normalizeListener(type, protocolInput, portInput) {
  const defaultProtocol = type === 'application' ? 'HTTP' : 'TCP';
  const defaultPort = type === 'application' ? 80 : 443;
  const allowedProtocols = type === 'application' ? ['HTTP', 'HTTPS'] : ['TCP', 'TLS', 'UDP'];
  const requestedProtocol = normalizeText(protocolInput).toUpperCase() || defaultProtocol;
  const protocol = allowedProtocols.includes(requestedProtocol) ? requestedProtocol : defaultProtocol;
  const port = parseInteger(portInput, defaultPort);

  if (port < 1 || port > 65535) {
    throw new Error('Listener port must be between 1 and 65535');
  }

  return { protocol, port };
}

function serializeLoadBalancer(loadBalancer) {
  const raw = typeof loadBalancer.toObject === 'function' ? loadBalancer.toObject() : loadBalancer;
  const targets = (raw.targets || []).map((target) => {
    const instance =
      target.instance && typeof target.instance === 'object' && target.instance._id
        ? serializeInstanceTarget(target.instance)
        : null;
    const healthStatus = instance
      ? (instance.status === 'running' ? 'healthy' : 'unhealthy')
      : (target.healthStatus || 'unknown');

    return {
      instance,
      port: target.port || raw.listener?.port || null,
      healthStatus
    };
  });

  const healthyTargetCount = targets.filter((target) => target.healthStatus === 'healthy').length;
  const totalTargetCount = targets.length;

  return {
    ...raw,
    _id: raw._id.toString(),
    status: computeLoadBalancerStatus(targets),
    targets,
    healthyTargetCount,
    totalTargetCount
  };
}

async function getLoadBalancersForUser(userId) {
  const loadBalancers = await LoadBalancer.find({ user: userId })
    .populate('vpc', 'name cidr region')
    .populate('targets.instance', 'name ip privateIp region status vpcId vpcName subnetId subnetName securityGroup')
    .sort({ createdAt: -1 });

  return loadBalancers.map(serializeLoadBalancer);
}

function buildNetworkSummary(vpcs, routeTables, loadBalancers, instanceTargets) {
  return {
    vpcs: vpcs.length,
    subnets: vpcs.reduce((total, vpc) => total + (vpc.subnets?.length || 0), 0),
    routeTables: routeTables.length,
    loadBalancers: loadBalancers.length,
    healthyTargets: loadBalancers.reduce(
      (total, loadBalancer) => total + (loadBalancer.healthyTargetCount || 0),
      0
    ),
    runningInstances: instanceTargets.filter((instance) => instance.status === 'running').length
  };
}

async function buildNetworkOverview(userId) {
  const vpcs = await VPC.find({ user: userId }).sort({ createdAt: -1 });
  await Promise.all(vpcs.map((vpc) => ensureMainRouteTableForVpc(userId, vpc)));

  const routeTables = await RouteTable.find({ user: userId })
    .populate('vpc', 'name cidr region')
    .sort({ createdAt: -1 });

  const loadBalancers = await getLoadBalancersForUser(userId);
  const instanceTargets = await Instance.find({ owner: userId })
    .select('name ip privateIp region status vpcId vpcName subnetId subnetName securityGroup')
    .sort({ createdAt: -1 });
  const serializedTargets = instanceTargets.map(serializeInstanceTarget);

  return {
    vpcs,
    routeTables,
    loadBalancers,
    instanceTargets: serializedTargets,
    summary: buildNetworkSummary(vpcs, routeTables, loadBalancers, serializedTargets)
  };
}

router.get('/overview', auth, async (req, res) => {
  try {
    const overview = await buildNetworkOverview(req.user.id);
    res.json(overview);
  } catch (err) {
    console.error('Get Network Overview Error:', err);
    res.status(500).json({ msg: 'Unable to load network overview', error: err.message });
  }
});

router.post('/vpc', auth, async (req, res) => {
  try {
    const name = normalizeText(req.body.name);
    const region = normalizeText(req.body.region);
    const cidr = normalizeText(req.body.cidr) || '10.0.0.0/16';

    if (!name || !region) {
      return res.status(400).json({ msg: 'Name and region are required' });
    }

    assertValidCidr(cidr, 'VPC CIDR');

    const duplicateVpc = await VPC.findOne({
      user: req.user.id,
      name
    });

    if (duplicateVpc) {
      return res.status(400).json({ msg: 'A VPC with that name already exists' });
    }

    const defaultSubnet = {
      name: `${slugify(name)}-public-a`,
      cidr: deriveSubnetCidr(cidr, 0),
      availabilityZone: 'a',
      type: 'public'
    };

    const vpc = new VPC({
      user: req.user.id,
      name,
      cidr,
      region,
      subnets: [defaultSubnet]
    });

    await vpc.save();

    const savedDefaultSubnet = vpc.subnets[0];
    const mainRouteTable = new RouteTable({
      user: req.user.id,
      vpc: vpc._id,
      name: `${name}-main`,
      isMain: true,
      routes: sanitizeCustomRoutes([], cidr),
      associatedSubnets: [
        {
          subnetId: savedDefaultSubnet._id.toString(),
          subnetName: savedDefaultSubnet.name,
          cidr: savedDefaultSubnet.cidr
        }
      ]
    });

    await mainRouteTable.save();
    res.json(vpc);
  } catch (err) {
    console.error('Create VPC Error:', err);
    const status = err.message?.includes('CIDR') ? 400 : 500;
    res.status(status).json({ msg: err.message || 'Server error', error: err.message });
  }
});

router.get('/vpc', auth, async (req, res) => {
  try {
    const vpcs = await VPC.find({ user: req.user.id }).sort({ createdAt: -1 });
    await Promise.all(vpcs.map((vpc) => ensureMainRouteTableForVpc(req.user.id, vpc)));
    res.json(vpcs);
  } catch (err) {
    console.error('Get VPCs Error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.delete('/vpc/:id', auth, async (req, res) => {
  try {
    const vpc = await findVpcForUser(req.user.id, req.params.id);

    if (!vpc) {
      return res.status(404).json({ msg: 'VPC not found' });
    }

    const attachedInstance = await Instance.findOne({
      owner: req.user.id,
      vpcId: vpc._id
    });

    if (attachedInstance) {
      return res.status(400).json({
        msg: 'Terminate or move instances attached to this VPC before removing it'
      });
    }

    const attachedLoadBalancer = await LoadBalancer.findOne({
      user: req.user.id,
      vpc: vpc._id
    });

    if (attachedLoadBalancer) {
      return res.status(400).json({
        msg: 'Delete load balancers attached to this VPC before removing the VPC'
      });
    }

    await RouteTable.deleteMany({ user: req.user.id, vpc: vpc._id });
    await VPC.findByIdAndDelete(vpc._id);

    res.json({ msg: 'VPC deleted' });
  } catch (err) {
    console.error('Delete VPC Error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

router.post('/vpc/:id/subnets', auth, async (req, res) => {
  try {
    const vpc = await findVpcForUser(req.user.id, req.params.id);

    if (!vpc) {
      return res.status(404).json({ msg: 'VPC not found' });
    }

    const name = normalizeText(req.body.name);
    const cidr = normalizeText(req.body.cidr);
    const availabilityZone = normalizeText(req.body.availabilityZone) || 'a';
    const type = normalizeText(req.body.type) === 'private' ? 'private' : 'public';

    if (!name || !cidr) {
      return res.status(400).json({ msg: 'Subnet name and CIDR are required' });
    }

    assertValidCidr(cidr, 'Subnet CIDR');

    if (!cidrContains(vpc.cidr, cidr)) {
      return res.status(400).json({ msg: 'Subnet CIDR must be inside the VPC CIDR range' });
    }

    const duplicateSubnet = vpc.subnets.find((subnet) =>
      subnet.name?.toLowerCase() === name.toLowerCase() || subnet.cidr === cidr
    );

    if (duplicateSubnet) {
      return res.status(400).json({ msg: 'Subnet name or CIDR already exists in this VPC' });
    }

    const overlappingSubnet = vpc.subnets.find((subnet) => cidrsOverlap(subnet.cidr, cidr));

    if (overlappingSubnet) {
      return res.status(400).json({
        msg: `Subnet CIDR overlaps with existing subnet ${overlappingSubnet.name}`
      });
    }

    vpc.subnets.push({
      name,
      cidr,
      availabilityZone,
      type
    });

    await vpc.save();

    const savedSubnet = vpc.subnets[vpc.subnets.length - 1];
    const mainRouteTable = await ensureMainRouteTableForVpc(req.user.id, vpc);

    if (mainRouteTable) {
      const isAlreadyAssociated = mainRouteTable.associatedSubnets.some(
        (association) => association.subnetId === savedSubnet._id.toString()
      );

      if (!isAlreadyAssociated) {
        mainRouteTable.associatedSubnets.push({
          subnetId: savedSubnet._id.toString(),
          subnetName: savedSubnet.name,
          cidr: savedSubnet.cidr
        });
        await mainRouteTable.save();
      }
    }

    res.json(savedSubnet);
  } catch (err) {
    console.error('Create Subnet Error:', err);
    const status = err.message?.includes('CIDR') ? 400 : 500;
    res.status(status).json({ msg: err.message || 'Server error', error: err.message });
  }
});

router.delete('/vpc/:id/subnets/:subnetId', auth, async (req, res) => {
  try {
    const vpc = await findVpcForUser(req.user.id, req.params.id);

    if (!vpc) {
      return res.status(404).json({ msg: 'VPC not found' });
    }

    const subnet = vpc.subnets.id(req.params.subnetId);

    if (!subnet) {
      return res.status(404).json({ msg: 'Subnet not found' });
    }

    const attachedInstance = await Instance.findOne({
      owner: req.user.id,
      subnetId: subnet._id.toString()
    });

    if (attachedInstance) {
      return res.status(400).json({
        msg: 'Terminate or move instances attached to this subnet before deleting it'
      });
    }

    vpc.subnets.pull(subnet._id);
    await vpc.save();

    await RouteTable.updateMany(
      {
        user: req.user.id,
        vpc: vpc._id
      },
      {
        $pull: {
          associatedSubnets: { subnetId: subnet._id.toString() }
        }
      }
    );

    res.json({ msg: 'Subnet deleted' });
  } catch (err) {
    console.error('Delete Subnet Error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

router.post('/routetable', auth, async (req, res) => {
  try {
    const name = normalizeText(req.body.name);
    const vpcId = normalizeText(req.body.vpcId);
    const subnetIds = Array.isArray(req.body.subnetIds)
      ? req.body.subnetIds.map((subnetId) => normalizeText(subnetId)).filter(Boolean)
      : [];
    const routes = Array.isArray(req.body.routes) ? req.body.routes : [];

    if (!name || !vpcId) {
      return res.status(400).json({ msg: 'Route table name and VPC are required' });
    }

    const vpc = await findVpcForUser(req.user.id, vpcId);

    if (!vpc) {
      return res.status(404).json({ msg: 'VPC not found' });
    }

    const duplicateRouteTable = await RouteTable.findOne({
      user: req.user.id,
      vpc: vpc._id,
      name
    });

    if (duplicateRouteTable) {
      return res.status(400).json({ msg: 'Route table name already exists in this VPC' });
    }

    const associations = mapSubnetAssociations(vpc, subnetIds);
    const routeTable = new RouteTable({
      user: req.user.id,
      vpc: vpc._id,
      name,
      routes: sanitizeCustomRoutes(routes, vpc.cidr),
      associatedSubnets: associations
    });

    await routeTable.save();

    if (subnetIds.length) {
      await RouteTable.updateMany(
        {
          user: req.user.id,
          vpc: vpc._id,
          _id: { $ne: routeTable._id }
        },
        {
          $pull: {
            associatedSubnets: { subnetId: { $in: subnetIds } }
          }
        }
      );
    }

    const populatedRouteTable = await RouteTable.findById(routeTable._id)
      .populate('vpc', 'name cidr region');

    res.json(populatedRouteTable);
  } catch (err) {
    console.error('Create Route Table Error:', err);
    const statusCode = err.message?.includes('Subnet') || err.message?.includes('route')
      || err.message?.includes('CIDR')
      ? 400
      : 500;
    res.status(statusCode).json({ msg: err.message || 'Server error' });
  }
});

router.get('/routetable', auth, async (req, res) => {
  try {
    const vpcs = await VPC.find({ user: req.user.id });
    await Promise.all(vpcs.map((vpc) => ensureMainRouteTableForVpc(req.user.id, vpc)));

    const routeTables = await RouteTable.find({ user: req.user.id })
      .populate('vpc', 'name cidr region')
      .sort({ createdAt: -1 });

    res.json(routeTables);
  } catch (err) {
    console.error('Get Route Tables Error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

router.delete('/routetable/:id', auth, async (req, res) => {
  try {
    const routeTable = await RouteTable.findOne({
      _id: req.params.id,
      user: req.user.id
    }).populate('vpc');

    if (!routeTable) {
      return res.status(404).json({ msg: 'Route table not found' });
    }

    if (routeTable.isMain) {
      return res.status(400).json({ msg: 'The main route table cannot be deleted' });
    }

    if (routeTable.vpc) {
      const mainRouteTable = await ensureMainRouteTableForVpc(req.user.id, routeTable.vpc);
      const existingAssociations = new Set(
        (mainRouteTable.associatedSubnets || []).map((association) => association.subnetId)
      );

      (routeTable.associatedSubnets || []).forEach((association) => {
        if (existingAssociations.has(association.subnetId)) {
          return;
        }

        mainRouteTable.associatedSubnets.push(association);
      });

      await mainRouteTable.save();
    }

    await RouteTable.findByIdAndDelete(routeTable._id);
    res.json({ msg: 'Route table deleted' });
  } catch (err) {
    console.error('Delete Route Table Error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

router.post('/loadbalancer', auth, async (req, res) => {
  try {
    const name = normalizeText(req.body.name);
    const type = normalizeText(req.body.type) === 'network' ? 'network' : 'application';
    const region = normalizeText(req.body.region);
    const vpcId = normalizeText(req.body.vpcId);
    const targetInstanceIds = Array.isArray(req.body.targetInstanceIds)
      ? [...new Set(req.body.targetInstanceIds.map((id) => normalizeText(id)).filter(Boolean))]
      : [];

    if (!name || !region || !vpcId) {
      return res.status(400).json({ msg: 'Load balancer name, region, and VPC are required' });
    }

    const selectedVpc = await findVpcForUser(req.user.id, vpcId);
    if (!selectedVpc) {
      return res.status(404).json({ msg: 'Selected VPC was not found' });
    }

    if (selectedVpc.region !== region) {
      return res.status(400).json({ msg: 'Load balancer region must match the selected VPC region' });
    }

    const duplicateLoadBalancer = await LoadBalancer.findOne({
      user: req.user.id,
      name
    });

    if (duplicateLoadBalancer) {
      return res.status(400).json({ msg: 'A load balancer with that name already exists' });
    }

    const listener = normalizeListener(type, req.body.listenerProtocol, req.body.listenerPort);
    const targetInstances = targetInstanceIds.length
      ? await Instance.find({
          _id: { $in: targetInstanceIds },
          owner: req.user.id
        }).select('name ip privateIp region status vpcId vpcName subnetId subnetName securityGroup')
      : [];

    if (targetInstances.length !== targetInstanceIds.length) {
      return res.status(400).json({ msg: 'One or more selected target instances were not found' });
    }

    const mismatchedTarget = targetInstances.find(
      (instance) => String(instance.vpcId || '') !== selectedVpc._id.toString()
    );

    if (mismatchedTarget) {
      return res.status(400).json({
        msg: 'All selected target instances must belong to the selected VPC'
      });
    }

    const targets = buildLoadBalancerTargets(targetInstances, listener.port);
    const loadBalancer = new LoadBalancer({
      user: req.user.id,
      name,
      type,
      region,
      vpc: selectedVpc._id,
      dnsName: createLoadBalancerDnsName(name, region, req.user.id),
      status: computeLoadBalancerStatus(targets),
      listener,
      targets
    });

    await loadBalancer.save();

    const hydratedLoadBalancer = await LoadBalancer.findById(loadBalancer._id)
      .populate('vpc', 'name cidr region')
      .populate('targets.instance', 'name ip privateIp region status vpcId vpcName subnetId subnetName securityGroup');

    res.json(serializeLoadBalancer(hydratedLoadBalancer));
  } catch (err) {
    console.error('Create LB Error:', err);
    const status = err.message?.includes('Listener port') ? 400 : 500;
    res.status(status).json({ msg: err.message || 'Server error', error: err.message });
  }
});

router.get('/loadbalancer', auth, async (req, res) => {
  try {
    const loadBalancers = await getLoadBalancersForUser(req.user.id);
    res.json(loadBalancers);
  } catch (err) {
    console.error('Get LBs Error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

router.delete('/loadbalancer/:id', auth, async (req, res) => {
  try {
    const loadBalancer = await LoadBalancer.findById(req.params.id);

    if (!loadBalancer) {
      return res.status(404).json({ msg: 'Not found' });
    }

    if (loadBalancer.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    await LoadBalancer.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Load Balancer deleted' });
  } catch (err) {
    console.error('Delete LB Error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

module.exports = router;
