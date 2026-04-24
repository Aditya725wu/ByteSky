const express = require('express');

const Instance = require('../models/Instance');
const Invoice = require('../models/Invoice');
const AuditLog = require('../models/AuditLog');
const Region = require('../models/Region');
const VPC = require('../models/VPC');
const auth = require('../middleware/auth');
const { getVmPricing } = require('../utils/pricing');

const router = express.Router();

function normalizeText(value = '') {
  return String(value || '').trim();
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
    prefix,
    start,
    end
  };
}

function generatePublicIp() {
  return `34.${Math.floor(Math.random() * 200) + 20}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 254) + 1}`;
}

function generatePrivateIp(subnetCidr) {
  const subnet = parseCidr(subnetCidr);
  const hostStart = subnet.prefix <= 30 ? subnet.start + 10 : subnet.start;
  const hostEnd = subnet.prefix <= 30 ? Math.max(hostStart, subnet.end - 10) : subnet.end;
  const hostCount = Math.max(hostEnd - hostStart + 1, 1);
  const offset = Math.floor(Math.random() * hostCount);
  return longToIp(hostStart + offset);
}

function buildInvoiceNumber(prefix = 'INV') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

// Create Instance with Invoice Generation
router.post('/', auth, async (req, res) => {
  try {
    const name = normalizeText(req.body.name);
    const os = normalizeText(req.body.os);
    const size = normalizeText(req.body.size);
    const requestedRegion = normalizeText(req.body.region);
    const vpcId = normalizeText(req.body.vpcId);
    const subnetId = normalizeText(req.body.subnetId);
    const securityGroup = normalizeText(req.body.securityGroup) || 'default';

    if (!name || !os || !size) {
      return res.status(400).json({ msg: 'Name, OS, and size are required' });
    }

    if (!vpcId || !subnetId) {
      return res.status(400).json({ msg: 'Select a VPC and subnet before launching an instance' });
    }

    const selectedVpc = await VPC.findOne({ _id: vpcId, user: req.user.id });
    if (!selectedVpc) {
      return res.status(404).json({ msg: 'Selected VPC was not found' });
    }

    const selectedSubnet = selectedVpc.subnets.id(subnetId);
    if (!selectedSubnet) {
      return res.status(404).json({ msg: 'Selected subnet was not found in that VPC' });
    }

    const finalRegion = requestedRegion || selectedVpc.region;
    if (selectedVpc.region !== finalRegion) {
      return res.status(400).json({ msg: 'Instance region must match the selected VPC region' });
    }

    console.log('Creating instance:', {
      name,
      os,
      size,
      region: finalRegion,
      vpcId,
      subnetId,
      userId: req.user.id
    });

    const regionCode = finalRegion || 'us-east-1';
    const regionData = await Region.findOne({ code: regionCode });
    const pricing = getVmPricing(size, regionCode, {
      regionMultiplier: regionData?.pricing?.compute,
      currency: regionData?.currency
    });
    const { currency, hourlyRate, monthlyCost } = pricing;
    const ip = generatePublicIp();
    const privateIp = generatePrivateIp(selectedSubnet.cidr);

    const newInstance = new Instance({
      name,
      os,
      size,
      region: finalRegion || 'us-east-1',
      vpcId: selectedVpc._id,
      vpcName: selectedVpc.name,
      subnetId: selectedSubnet._id.toString(),
      subnetName: selectedSubnet.name,
      subnetCidr: selectedSubnet.cidr,
      subnetType: selectedSubnet.type,
      availabilityZone: selectedSubnet.availabilityZone,
      privateIp,
      securityGroup,
      ip,
      currency,
      cost: monthlyCost,
      hourlyRate,
      owner: req.user.id
    });

    await newInstance.save();
    console.log('Instance created:', newInstance._id);

    const launchInvoice = new Invoice({
      user: req.user.id,
      invoiceNumber: buildInvoiceNumber('INV'),
      amount: monthlyCost,
      description: `VM Launch: ${name} (${size}) - Monthly Subscription`,
      items: [{
        description: `VM Instance - ${name} (${os})`,
        quantity: 1,
        unitPrice: monthlyCost,
        total: monthlyCost,
        resourceType: 'Compute'
      }],
      currency,
      region: finalRegion || 'us-east-1',
      usageHours: 0,
      status: 'Unpaid'
    });

    await launchInvoice.save();
    console.log('Launch invoice created:', launchInvoice.invoiceNumber);

    await AuditLog.create({
      user: req.user.id,
      action: 'VM_CREATE',
      resource: 'Instance',
      resourceId: newInstance._id,
      details: {
        name,
        os,
        size,
        region: finalRegion,
        publicIp: ip,
        privateIp,
        monthlyCost,
        vpcName: selectedVpc.name,
        subnetName: selectedSubnet.name,
        securityGroup
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    setTimeout(async () => {
      try {
        await Instance.findByIdAndUpdate(newInstance._id, {
          status: 'running',
          startTime: new Date()
        });
        console.log('Instance status updated to running:', newInstance._id);

        await AuditLog.create({
          user: req.user.id,
          action: 'VM_STARTED',
          resource: 'Instance',
          resourceId: newInstance._id,
          details: {
            status: 'running',
            vpcName: selectedVpc.name,
            subnetName: selectedSubnet.name
          }
        });
      } catch (error) {
        console.error('Error updating instance status:', error);
      }
    }, 3000);

    res.json(newInstance);
  } catch (err) {
    console.error('Create Instance Error:', err);
    const statusCode = err.message?.includes('CIDR') ? 400 : 500;
    res.status(statusCode).json({ msg: err.message || 'Server error', error: err.message });
  }
});

// Get All Instances
router.get('/', auth, async (req, res) => {
  try {
    console.log('Fetching instances for user:', req.user.id);
    const instances = await Instance.find({ owner: req.user.id }).sort({ createdAt: -1 });
    console.log('Found instances:', instances.length);
    res.json(instances);
  } catch (err) {
    console.error('Get Instances Error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get Single Instance with Metrics
router.get('/:id', auth, async (req, res) => {
  try {
    const instance = await Instance.findById(req.params.id);
    if (!instance) return res.status(404).json({ msg: 'Instance not found' });
    if (instance.owner.toString() !== req.user.id) return res.status(401).json({ msg: 'Not authorized' });

    res.json(instance);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Delete Instance with Usage Billing (Final Charge)
router.delete('/:id', auth, async (req, res) => {
  try {
    const instance = await Instance.findById(req.params.id);

    if (!instance) return res.status(404).json({ msg: 'Instance not found' });
    if (instance.owner.toString() !== req.user.id) return res.status(401).json({ msg: 'Not authorized' });

    const startTime = instance.startTime || instance.createdAt;
    const endTime = new Date();
    const usageHours = (endTime - startTime) / (1000 * 60 * 60);
    const expectedMonthlyHours = 730;
    const usageRatio = Math.min(usageHours / expectedMonthlyHours, 1);
    const regionData = await Region.findOne({ code: instance.region || 'us-east-1' });
    const pricing = getVmPricing(instance.size || 'micro', instance.region || 'us-east-1', {
      regionMultiplier: regionData?.pricing?.compute,
      currency: instance.currency
    });
    const hasStoredPricing = Boolean(instance.currency) &&
      Number.isFinite(Number(instance.cost)) &&
      Number.isFinite(Number(instance.hourlyRate));
    const monthlyCost = hasStoredPricing ? Number(instance.cost) : pricing.monthlyCost;
    const hourlyRate = hasStoredPricing ? Number(instance.hourlyRate) : pricing.hourlyRate;
    const billingCurrency = hasStoredPricing ? instance.currency : pricing.currency;
    const proratedCost = monthlyCost * usageRatio;

    if (usageHours > 0) {
      const finalInvoice = new Invoice({
        user: req.user.id,
        invoiceNumber: buildInvoiceNumber('INV-TERM'),
        amount: proratedCost,
        description: `VM Termination: ${instance.name} - Final Usage (${usageHours.toFixed(2)} hrs)`,
        items: [{
          description: `VM Runtime Adjustment - ${instance.name}`,
          quantity: usageHours,
          unitPrice: hourlyRate,
          total: proratedCost,
          resourceType: 'Compute'
        }],
        currency: billingCurrency,
        region: instance.region,
        usageHours,
        status: 'Unpaid'
      });

      await finalInvoice.save();
      console.log('Termination invoice created:', finalInvoice.invoiceNumber);
    }

    await AuditLog.create({
      user: req.user.id,
      action: 'VM_DELETE',
      resource: 'Instance',
      resourceId: instance._id,
      details: {
        name: instance.name,
        usageHours: usageHours.toFixed(2),
        finalCost: proratedCost,
        region: instance.region,
        vpcName: instance.vpcName,
        subnetName: instance.subnetName
      },
      ipAddress: req.ip
    });

    await Instance.findByIdAndDelete(req.params.id);
    console.log('Instance terminated:', req.params.id);

    res.json({
      msg: 'Instance terminated',
      usageHours: usageHours.toFixed(2),
      finalCost: proratedCost.toFixed(2)
    });
  } catch (err) {
    console.error('Delete Instance Error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// Start/Stop Instance
router.patch('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const instance = await Instance.findById(req.params.id);

    if (!instance) return res.status(404).json({ msg: 'Instance not found' });
    if (instance.owner.toString() !== req.user.id) return res.status(401).json({ msg: 'Not authorized' });

    const updateData = { status };
    if (status === 'running') {
      updateData.startTime = new Date();
    } else if (status === 'stopped') {
      updateData.endTime = new Date();
    }

    await Instance.findByIdAndUpdate(req.params.id, updateData);

    await AuditLog.create({
      user: req.user.id,
      action: `VM_${status.toUpperCase()}`,
      resource: 'Instance',
      resourceId: instance._id,
      details: {
        status,
        timestamp: new Date(),
        vpcName: instance.vpcName,
        subnetName: instance.subnetName
      }
    });

    console.log(`Instance ${instance.name} status: ${status}`);
    res.json({ msg: `Instance ${status}`, instanceId: instance._id });
  } catch (err) {
    console.error('Update Instance Status Error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

module.exports = router;
