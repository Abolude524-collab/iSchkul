const express = require('express');
const auth = require('../middleware/auth');

const router = express.Router();

// Mock groups data
let groups = [
  {
    _id: '1',
    name: 'General',
    description: 'General discussion',
    memberIds: ['1', '2'],
    createdBy: '1',
    createdAt: new Date().toISOString()
  },
  {
    _id: '2',
    name: 'Physics Study Group',
    description: 'Discuss physics concepts',
    memberIds: ['1'],
    createdBy: '1',
    createdAt: new Date().toISOString()
  }
];

// Get all groups
router.get('/', auth, (req, res) => {
  try {
    // Filter groups where user is a member
    const userGroups = groups.filter(group =>
      group.memberIds.includes(req.user._id.toString())
    );
    res.json({ groups: userGroups });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get group by ID
router.get('/:id', auth, (req, res) => {
  try {
    const group = groups.find(g => g._id === req.params.id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (!group.memberIds.includes(req.user._id.toString())) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    res.json({ group });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create new group
router.post('/create', auth, (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Group name is required' });
    }

    const newGroup = {
      _id: Date.now().toString(),
      name,
      description: description || '',
      memberIds: [req.user._id.toString()],
      createdBy: req.user._id.toString(),
      createdAt: new Date().toISOString()
    };

    groups.push(newGroup);
    res.status(201).json({ group: newGroup });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Join group
router.post('/:id/join', auth, (req, res) => {
  try {
    const group = groups.find(g => g._id === req.params.id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (group.memberIds.includes(req.user._id.toString())) {
      return res.status(400).json({ error: 'Already a member' });
    }

    group.memberIds.push(req.user._id.toString());
    res.json({ group });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;