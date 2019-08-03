var express = require('express');
var router = express.Router();
const domain = require('../config/domain');
const axios = require('axios');

/* GET users listing. */
router.get('/:idCourse', async function(req, res, next) {
    let course;
    await axios({
            method: 'get',
            url: `${domain}/api/course/${req.params.idCourse}`
        }).then(Response => {
            course = Response.data;
        }).catch(err => {
            console.log(err)
        });

    if(req.session.token){
        res.render("student/student-take-course", {course});
    } else{
        res.render("course/course", {course});
    }
});


module.exports = router;
