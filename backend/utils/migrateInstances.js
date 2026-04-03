const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Instance = require('../models/Instance');

dotenv.config();

async function migrateInstances() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Find all instances without hourlyRate or with null value
    const instances = await Instance.find({ 
      $or: [
        { hourlyRate: { $exists: false } },
        { hourlyRate: null },
        { hourlyRate: 0 }
      ] 
    });

    console.log(`📊 Found ${instances.length} instances to migrate`);

    if (instances.length === 0) {
      console.log('✅ No migration needed - all instances have hourlyRate');
      process.exit(0);
    }

    // Update each instance using updateOne (bypasses middleware issues)
    for (const inst of instances) {
      let baseRate = 5;
      if (inst.size === 'small') baseRate = 10;
      if (inst.size === 'large') baseRate = 40;

      const hourlyRate = baseRate / 730; // Calculate hourly from monthly

      // Use updateOne to avoid middleware issues
      await Instance.updateOne(
        { _id: inst._id },
        { 
          $set: { 
            hourlyRate: hourlyRate,
            updatedAt: new Date()
          } 
        }
      );
      
      console.log(`✓ Updated: ${inst.name} - $${hourlyRate.toFixed(4)}/hr`);
    }

    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration Error:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
  }
}

migrateInstances();