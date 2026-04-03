const express = require('express');
const router = express.Router();
const Metric = require('../models/Metric');
const Instance = require('../models/Instance');
const auth = require('../middleware/auth');

// Get Instance Metrics (Time-Series)
router.get('/metrics/:instanceId', auth, async (req, res) => {
  try {
    const { instanceId } = req.params;
    const { hours = 24 } = req.query;
    
    const instance = await Instance.findById(instanceId);
    if (!instance) return res.status(404).json({ msg: 'Instance not found' });
    if (instance.owner.toString() !== req.user.id) return res.status(401).json({ msg: 'Not authorized' });

    const startTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
    
    const metrics = await Metric.find({
      instance: instanceId,
      timestamp: { $gte: startTime }
    }).sort({ timestamp: 1 });

    res.json(metrics);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get All Metrics Summary
router.get('/summary', auth, async (req, res) => {
  try {
    const instances = await Instance.find({ owner: req.user.id, status: 'running' });
    
    const summary = await Promise.all(instances.map(async (inst) => {
      const latestMetric = await Metric.findOne({ instance: inst._id }).sort({ timestamp: -1 });
      return {
        id: inst._id,
        name: inst.name,
        region: inst.region,
        cpu: latestMetric ? latestMetric.cpu : 0,
        ram: latestMetric ? latestMetric.ram : 0,
        networkIn: latestMetric ? latestMetric.networkIn : 0,
        networkOut: latestMetric ? latestMetric.networkOut : 0
      };
    }));

    res.json(summary);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get Historical Data for Charts
router.get('/history/:instanceId', auth, async (req, res) => {
  try {
    const { instanceId } = req.params;
    const { period = '1h' } = req.query;
    
    let timeRange;
    switch(period) {
      case '1h': timeRange = 1; break;
      case '6h': timeRange = 6; break;
      case '24h': timeRange = 24; break;
      case '7d': timeRange = 168; break;
      default: timeRange = 24;
    }

    const startTime = new Date(Date.now() - (timeRange * 60 * 60 * 1000));
    
    const metrics = await Metric.find({
      instance: instanceId,
      timestamp: { $gte: startTime }
    }).sort({ timestamp: 1 });

    const chartData = {
      labels: metrics.map(m => new Date(m.timestamp).toISOString()),
      cpu: metrics.map(m => m.cpu),
      ram: metrics.map(m => m.ram),
      networkIn: metrics.map(m => m.networkIn),
      networkOut: metrics.map(m => m.networkOut)
    };

    res.json(chartData);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
