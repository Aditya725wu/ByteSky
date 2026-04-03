const fs = require('fs');
const path = require('path');

const express = require('express');
const multer = require('multer');

const env = require('../config/env');
const Bucket = require('../models/Bucket');
const StorageObject = require('../models/StorageObject');
const auth = require('../middleware/auth');
const {
  deleteCachedValue,
  getBucketsCacheKey,
  getCachedValue,
  isCacheAvailable,
  setCachedValue
} = require('../services/cache.service');

const router = express.Router();

function sanitizeSegment(value, fallback = 'default') {
  const sanitized = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_');

  return sanitized || fallback;
}

function toStoredRelativePath(userId, bucketName, fileName) {
  return path.join('storage', sanitizeSegment(userId), sanitizeSegment(bucketName), fileName);
}

function toAbsolutePath(relativePath) {
  return path.join(env.uploadsDir, relativePath);
}

function formatBucket(bucket, stats = { objects: 0, size: 0 }) {
  return {
    id: bucket._id.toString(),
    name: bucket.name,
    region: bucket.region,
    storageClass: bucket.storageClass,
    versioning: bucket.versioning,
    isPublic: bucket.isPublic,
    owner: bucket.user.toString(),
    createdAt: bucket.createdAt,
    objects: stats.objects,
    size: stats.size
  };
}

async function loadBucketsForUser(userId) {
  const buckets = await Bucket.find({ user: userId }).sort({ createdAt: -1 }).lean();
  const files = await StorageObject.find({ user: userId }).select('bucket fileSize').lean();
  const bucketStats = files.reduce((stats, file) => {
    if (!stats[file.bucket]) {
      stats[file.bucket] = { objects: 0, size: 0 };
    }

    stats[file.bucket].objects += 1;
    stats[file.bucket].size += file.fileSize || 0;
    return stats;
  }, {});

  return buckets.map((bucket) => formatBucket(bucket, bucketStats[bucket.name] || { objects: 0, size: 0 }));
}

const upload = multer({
  storage: multer.diskStorage({
    destination(req, file, cb) {
      const bucketName = sanitizeSegment(req.body.bucket, 'uncategorized');
      const relativeDir = path.join('storage', sanitizeSegment(req.user.id), bucketName);
      const absoluteDir = toAbsolutePath(relativeDir);
      fs.mkdirSync(absoluteDir, { recursive: true });
      cb(null, absoluteDir);
    },
    filename(req, file, cb) {
      const ext = path.extname(file.originalname || '');
      const baseName = path.basename(file.originalname || 'file', ext);
      const uniqueName = `${Date.now()}-${sanitizeSegment(baseName, 'file')}${ext}`;
      cb(null, uniqueName);
    }
  }),
  limits: {
    fileSize: 100 * 1024 * 1024
  }
});

// Get all buckets
router.get('/buckets', auth, async (req, res) => {
  try {
    const cacheKey = getBucketsCacheKey(req.user.id);

    if (isCacheAvailable()) {
      const cachedBuckets = await getCachedValue(cacheKey);
      if (cachedBuckets !== null) {
        res.set('X-Cache', 'HIT');
        return res.json(cachedBuckets);
      }
    }

    const buckets = await loadBucketsForUser(req.user.id);

    if (isCacheAvailable()) {
      await setCachedValue(cacheKey, buckets, 60);
      res.set('X-Cache', 'MISS');
    } else {
      res.set('X-Cache', 'BYPASS');
    }

    res.json(buckets);
  } catch (err) {
    console.error('Get Buckets Error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// Create bucket
router.post('/buckets', auth, async (req, res) => {
  try {
    const { name, region, storageClass, versioning, isPublic } = req.body;
    const normalizedName = name?.trim();
    const normalizedRegion = region?.trim();

    if (!normalizedName || !normalizedRegion) {
      return res.status(400).json({ msg: 'Name and region are required' });
    }

    const existingBucket = await Bucket.findOne({ user: req.user.id, name: normalizedName });
    if (existingBucket) {
      return res.status(400).json({ msg: 'Bucket name already exists' });
    }

    const newBucket = new Bucket({
      user: req.user.id,
      name: normalizedName,
      region: normalizedRegion,
      storageClass: storageClass || 'standard',
      versioning: versioning || false,
      isPublic: isPublic || false
    });

    await newBucket.save();
    fs.mkdirSync(toAbsolutePath(path.join('storage', sanitizeSegment(req.user.id), sanitizeSegment(normalizedName))), {
      recursive: true
    });
    await deleteCachedValue(getBucketsCacheKey(req.user.id));
    res.status(201).json({ msg: 'Bucket created', bucket: formatBucket(newBucket) });
  } catch (err) {
    console.error('Create Bucket Error:', err);
    if (err.code === 11000) {
      return res.status(400).json({ msg: 'Bucket name already exists' });
    }
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// Get all storage objects
router.get('/', auth, async (req, res) => {
  try {
    const files = await StorageObject.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(files);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Upload file
router.post('/upload', auth, upload.single('file'), async (req, res) => {
  try {
    const bucketName = req.body.bucket?.trim();
    const existingBucket = await Bucket.findOne({ name: bucketName, user: req.user.id });

    if (!existingBucket) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ msg: 'Bucket not found' });
    }

    if (!req.file) {
      return res.status(400).json({ msg: 'No file uploaded' });
    }

    const relativePath = toStoredRelativePath(req.user.id, bucketName, req.file.filename);
    const newFile = new StorageObject({
      user: req.user.id,
      bucket: bucketName,
      fileName: req.file.originalname,
      filePath: relativePath,
      fileSize: req.file.size,
      fileType: req.file.mimetype || 'application/octet-stream'
    });

    await newFile.save();
    await deleteCachedValue(getBucketsCacheKey(req.user.id));
    res.json({ msg: 'File uploaded', file: newFile });
  } catch (err) {
    console.error('Upload File Error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// Public share file
router.get('/share/:id', async (req, res) => {
  try {
    const file = await StorageObject.findById(req.params.id);
    if (!file) return res.status(404).json({ msg: 'File not found' });
    if (!file.filePath) return res.status(404).json({ msg: 'Stored file content is not available for this record' });

    const absolutePath = toAbsolutePath(file.filePath);
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ msg: 'File content not found on disk' });
    }

    if (file.fileType) {
      res.type(file.fileType);
    }

    const safeFileName = String(file.fileName || 'file').replace(/[\r\n"]/g, '');
    res.set('Content-Disposition', `inline; filename="${safeFileName}"`);
    return res.sendFile(absolutePath);
  } catch (err) {
    console.error('Share File Error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Download file
router.get('/:id/download', auth, async (req, res) => {
  try {
    const file = await StorageObject.findById(req.params.id);
    if (!file) return res.status(404).json({ msg: 'File not found' });
    if (file.user.toString() !== req.user.id) return res.status(401).json({ msg: 'Not authorized' });
    if (!file.filePath) return res.status(404).json({ msg: 'Stored file content is not available for this record' });

    const absolutePath = toAbsolutePath(file.filePath);
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ msg: 'File content not found on disk' });
    }

    return res.download(absolutePath, file.fileName);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Delete file
router.delete('/:id', auth, async (req, res) => {
  try {
    const file = await StorageObject.findById(req.params.id);
    if (!file) return res.status(404).json({ msg: 'File not found' });
    if (file.user.toString() !== req.user.id) return res.status(401).json({ msg: 'Not authorized' });

    if (file.filePath) {
      const absolutePath = toAbsolutePath(file.filePath);
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
    }

    await StorageObject.findByIdAndDelete(req.params.id);
    await deleteCachedValue(getBucketsCacheKey(req.user.id));
    res.json({ msg: 'File deleted' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
