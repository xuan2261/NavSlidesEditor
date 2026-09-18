const express = require('express')
const { isCurrentPresenterBootstrap } = require('./presentations-helpers')

// Route groups are split by domain (crud / pptx / extras). Mount order matters:
// crud first so GET /trash/list stays ahead of GET /:id, and no sub-router
// defines a bare POST/GET /:id that could shadow another group's literal or
// two-segment routes.
const router = express.Router()
router.use(require('./presentations-crud'))
router.use(require('./presentations-pptx'))
router.use(require('./presentations-extras'))

router.isCurrentPresenterBootstrap = isCurrentPresenterBootstrap

module.exports = router
