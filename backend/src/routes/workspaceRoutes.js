const express = require('express');
const router = express.Router();
const { getWorkspaces, createWorkspace } = require('../controllers/workspaceController');
const { authenticate } = require('../middleware/authMiddleware');

router.get('/', getWorkspaces);
router.post('/', authenticate, createWorkspace);

module.exports = router;
