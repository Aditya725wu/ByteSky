const Region = require('../models/Region');
const User = require('../models/User');
const env = require('../config/env');
const logger = require('../config/logger');

const defaultRegions = [
  { code: 'us-east-1', name: 'US East (N. Virginia)', pricing: { compute: 1.0, storage: 1.0, network: 1.0 } },
  { code: 'us-west-2', name: 'US West (Oregon)', pricing: { compute: 1.1, storage: 1.05, network: 1.0 } },
  { code: 'eu-west-1', name: 'EU West (Ireland)', pricing: { compute: 1.15, storage: 1.1, network: 1.05 } },
  { code: 'ap-south-1', name: 'Asia Pacific (Mumbai)', pricing: { compute: 1.2, storage: 1.15, network: 1.1 } },
  { code: 'ap-northeast-1', name: 'Asia Pacific (Tokyo)', pricing: { compute: 1.25, storage: 1.2, network: 1.1 } }
];

async function seedAdminUser() {
  const adminExists = await User.findOne({ email: env.adminSeedEmail });

  if (!adminExists) {
    await User.create({
      name: env.adminSeedName,
      email: env.adminSeedEmail,
      password: env.adminSeedPassword,
      role: 'admin'
    });

    logger.info(`Admin user seeded: ${env.adminSeedEmail}`);
    return;
  }

  if (adminExists.role !== 'admin') {
    adminExists.role = 'admin';
    await adminExists.save();
    logger.info(`Admin role restored for ${env.adminSeedEmail}`);
  }
}

async function seedRegions() {
  await Promise.all(
    defaultRegions.map((region) =>
      Region.findOneAndUpdate(
        { code: region.code },
        region,
        { upsert: true, returnDocument: 'after' }
      )
    )
  );

  logger.info(`Seeded ${defaultRegions.length} regions`);
}

async function seedCoreData() {
  await seedAdminUser();
  await seedRegions();
}

module.exports = {
  seedCoreData
};
