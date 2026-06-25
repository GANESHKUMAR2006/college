const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/departmentController');

router.get('/', departmentController.getDepartments);
router.post('/', departmentController.addDepartment);
router.put('/:id', departmentController.editDepartment);
router.delete('/:id', departmentController.deleteDepartment);

module.exports = router;
