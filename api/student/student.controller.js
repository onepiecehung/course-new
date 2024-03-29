const Student = require("./student.model");
const Course = require("./../course/course.model");
const Teacher = require("./../teacher/teacher.model");
const Quiz = require("./../quiz/quiz.model");
const Lesson = require("./../lesson/lesson.model");

module.exports = {
  buyCourse: async (req, res) => {
    try {
      let student = await Student.findOne({
        user: req.user.data._id
      }).select("balance courses.id_course");
      let listIdCoursePurchased = [];
      for (let i = 0; i < student.courses.length; i++) {
        listIdCoursePurchased.push(student.courses[i].id_course.toString());
      }
      if (listIdCoursePurchased.includes(req.params.idCourse))
        throw new Error("You bought the course");
      let course = await Course.findById(req.params.idCourse);
      if (student.balance < course.price) {
        throw new Error("Your balance is not enough!");
      }
      await Course.findByIdAndUpdate(req.params.idCourse, {
        $inc: { students_enrolled: +1 }
      });
      let course_purchased = {
        id_course: req.params.idCourse
        // lesson_number: 0
      };
      await Student.findOneAndUpdate(
        { user: req.user.data._id },
        {
          $push: { courses: course_purchased },
          $inc: { balance: -course.price }
        }
      );
      let transaction = {
        course: course._id,
        date_trading: new Date().toLocaleDateString(),
        value: course.price
      };
      await Teacher.findOneAndUpdate(
        {
          user: course.teacher
        },
        {
          $inc: {
            salary: +(course.price * 0.7)
          },
          $push: {
            transaction: transaction
          }
        }
      );
      // 30% for admin
      res.status(200).json({
        message: "buy course successfully!"
      });
    } catch (error) {
      if (error.name == "CastError")
        res.status(404).json({
          error_msg: "Course was not found"
        });
      res.status(500).json({
        error_msg: error.message
      });
    }
  },

  answerQuestion: async (req, res) => {
    try {
      // let quiz = await Quiz.findById(req.params.idQuiz).populate('lesson');
      let student = await Student.findOne({ user: req.user.data._id });
      //check purchased course
      let course_purchased = [];
      for (let i = 0; i < student.courses.length; i++) {
        course_purchased.push(student.courses[i].id_course.toString());
      }
      let lesson = await Lesson.findById(req.params.idLesson);
      if (!lesson) return res.status(404).json({ message: "lesson not found" });
      if (!course_purchased.includes(lesson.course.toString())) {
        return res.status(400).json({
          message: "The quiz is not in the course you purchased"
        });
      }
      let quizzes = await Quiz.find({ lesson: req.params.idLesson });
      let quizzes_answer = quizzes.map(item => item.result);
      let result = [];
      let answer = req.body.answer;
      let amountQuizTrueOfLesson = 0;
      for (let i = 0; i < quizzes_answer.length; i++) {
        if (answer[i] !== quizzes_answer[i]) {
          result.push(false);
        } else {
          result.push(true);
          amountQuizTrueOfLesson += 1;
        }
      }
      let amount_true = result.filter(x => x == true).length;
      await Student.findOneAndUpdate(
        {
          user: req.user.data._id
        },
        {
          $push: {
            // quiz_true: answer,
            iq: {
              value: amount_true * 10,
              date: new Date()
            }
          }
        }
      );
      if (amountQuizTrueOfLesson / quizzes_answer.length >= 0.6) {
        await Student.findOneAndUpdate(
          {
            user: req.user.data._id,
            "courses.id_course": lesson.course
          },
          {
            $addToSet: {
              "courses.$.lesson_number": req.params.idLesson
            }
          }
        );
      }
      res.status(200).json({ result });
    } catch (error) {
      res.status(500).json({
        error_msg: error
      });
    }
  },

  setLessonStudied: async (req, res) => {
    try {
      let lesson = await Lesson.findById(req.params.idLesson);
      if (!lesson) return res.status(404).json({ message: "Lesson not found" });
      let amountQuizOfLesson = lesson.quizzes.length;
      let student = await Student.findOne({
        user: req.user.data._id
      });
      let quizOfLesson = [];
      for (let i = 0; i < student.quiz_true.length; i++) {
        if (student.quiz_true[i].lesson == req.params.idLesson)
          quizOfLesson.push(student.quiz_true[i].id);
      }
      let amountQuizTrueOfLesson = quizOfLesson.length;
      //if pass 60% quiz in lession then set complete this lesson
      if (amountQuizTrueOfLesson / amountQuizOfLesson >= 0.6) {
        await Student.findOneAndUpdate(
          {
            user: req.user.data._id,
            "courses.id_course": lesson.course
          },
          {
            $addToSet: {
              "courses.$.lesson_number": req.params.idLesson
            }
          }
        );
        return res.status(200).json({
          message: "You are complete lesson"
        });
      }
      res.status(200).json({
        message: "You are not complete lesson"
      });
    } catch (error) {
      res.status(500).json({
        err_msg: error.message
      });
    }
  },

  getStudent: async (req, res) => {
    try {
      let info = await Student.findOne({
        user: req.params.idStudent
      })
        .populate("user")
        .select("-_id");
      if (!info) return res.status(404).json("Student not found");
      res.status(200).json(info);
    } catch (error) {
      res.status(500).json({
        err_msg: error.message
      });
    }
  },

  getAllCoursePurchased: async (req, res) => {
    try {
      let course = await Student.findOne({
        user: req.user.data._id
      })
        .populate({
          path: "courses.id_course",
          populate: {
            path: "teacher",
            select: "fullname -_id"
          }
        })
        .select("courses -_id");
      if (!course) return res.status(404).json("Student not found");
      res.status(200).json(course);
    } catch (error) {
      res.status(500).json({
        err_msg: error.message
      });
    }
  },

  getAllCourseNotPurchased: async (req, res) => {
    try {
      let coursePurchased = await Student.findOne({
        user: req.user.data._id
      }).select("courses.id_course -_id");
      if (!coursePurchased) return res.status(404).json("Student not found");
      let listIdCoursePurchased = [];
      for (let i = 0; i < coursePurchased.courses.length; i++) {
        listIdCoursePurchased.push(coursePurchased.courses[i].id_course);
      }
      let courseNotPurchased = await Course.find({
        _id: {
          $nin: listIdCoursePurchased
        }
      })
        .sort({
          _id: -1
        })
        .limit(3);
      res.status(200).json(courseNotPurchased);
    } catch (error) {
      res.status(500).json({
        err_msg: error.message
      });
    }
  },

  getTotalIq: async (req, res) => {
    try {
      let student = await Student.findOne({ user: req.user.data._id });
      total_iq = 0;
      for (let i = 0; i < student.iq.length; i++) {
        total_iq += student.iq[i].value;
      }
      res.status(200).json({ total_iq: total_iq });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  getIqAWeek: async (req, res) => {
    try {
      let student = await Student.findOne({ user: req.user.data._id });
      list_iq = [];
      let d = new Date();
      for (let i = 0; i < 7; i++) {
        let iqOneDate = 0;
        for (let j = 0; j < student.iq.length; j++) {
          if (
            student.iq[j].date.toLocaleDateString() == d.toLocaleDateString()
          ) {
            iqOneDate += student.iq[i].value;
          }
        }
        list_iq.push(iqOneDate);
        d.setDate(d.getDate() - 1);
      } //present to pass
      res.status(200).json({ list_iq: list_iq });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  setCourseStudied: async (req, res) => {
    try {
      let student = await Student.findOne({ user: req.user.data._id });
      for (let i = 0; i < student.courses.length; i++) {
        let course = await Course.findById(student.courses[i].id_course);
        if (student.courses[i].lesson_number.length == course.lessons.length)
          await Student.findOneAndUpdate(
            { user: req.user.data._id },
            { $addToSet: { course_studied: student.courses[i].id_course } }
          );
      }
      let course_studied = await Student.findOne({ user: req.user.data._id })
        .populate("course_studied")
        .select("course_studied");
      res.status(200).json({ course_studied });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  getCourseStudied: async (req, res) => {
    try {
      let student = await Student.findOne({ user: req.user.data._id }).populate(
        "course_studied"
      );
      res.status(200).json({
        course_studied: student.course_studied
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  getTotalIq1: async (req, res) => {
    try {
      let student = await Student.findOne({ user: req.params.id });
      total_iq = 0;
      for (let i = 0; i < student.iq.length; i++) {
        total_iq += student.iq[i].value;
      }
      res.status(200).json({ total_iq: total_iq });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  getIqAWeek1: async (req, res) => {
    try {
      let student = await Student.findOne({ user: req.params.id });
      list_iq = [];
      let d = new Date();
      for (let i = 0; i < 7; i++) {
        let iqOneDate = 0;
        for (let j = 0; j < student.iq.length; j++) {
          if (
            student.iq[j].date.toLocaleDateString() == d.toLocaleDateString()
          ) {
            iqOneDate += student.iq[i].value;
          }
        }
        list_iq.push(iqOneDate);
        d.setDate(d.getDate() - 1);
      } //present to pass
      res.status(200).json({ list_iq: list_iq });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  getCourseStudied1: async (req, res) => {
    try {
      let student = await Student.findOne({ user: req.params.id }).populate(
        "course_studied"
      );
      res.status(200).json({
        course_studied: student.course_studied
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
};
