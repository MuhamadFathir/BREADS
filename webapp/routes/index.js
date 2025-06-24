var express = require('express');
const { generatePassword, comparePassword, isLoggedIn } = require('../helper/util');
var router = express.Router();
const path = require('path')


module.exports = function (db) {
  router.get('/', function (req, res, next) {
    res.render('login', { errorMessage: req.flash('errorMessage'), successMessage: req.flash('successMessage') });
  });

  router.post('/login', function (req, res) {
    const { email, password } = req.body

    db.query('SELECT * FROM users WHERE email = $1', [email]).then((data) => {
      if (data.rows.length == 0) {
        req.flash('errorMessage', `Email doesn't exist`)
        res.redirect('/')
      } else {
        if (comparePassword(password, data.rows[0].password)) {
          req.session.user = data.rows[0]
          res.redirect('/todos')
        } else {
          req.flash('errorMessage', `Wrong Password!`)
          res.redirect('/')
        }
      }
    }).catch((e) => {
      req.flash('errorMessage', `Gagal login`)
      res.redirect('/')
    })
  })

  router.get('/register', function (req, res, next) {
    res.render('register', { errorMessage: req.flash('errorMessage'), successMessage: req.flash('successMessage') });
  });

  router.post('/register', function (req, res) {
    const { email, password, repassword } = req.body

    if (password !== repassword) {
      req.flash('errorMessage', `Password doesn't match!`)
      return res.redirect('/register')
    }

    db.query('SELECT * FROM users WHERE email = $1', [email]).then((data) => {
      console.log(data)
      if (data.rows.length > 0) {
        req.flash('errorMessage', `Email already exist`)
        res.redirect('/register')
      } else {
        const hashed = generatePassword(password);
        db.query(
          'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *',
          [email, hashed]
        ).then((user) => {

          req.session.user = user.rows[0]
          req.flash('successMessage', `Succesfully registered please sign in`)
          res.redirect('/')
        }).catch((e) => {
          console.log(e)
          res.redirect('/register')
        })
      }
    }).catch((err) => {
      res.send(err.message)
    })
  })

  router.get('/logout', function (req, res) {
    req.session.destroy(function () {
      res.redirect('/')
    })
  })

  router.get('/avatar', isLoggedIn, function (req, res) {
    res.render('avatar', { title: ' Upload Avatar', user: req.session.user, avatar: req.session.user.avatar || null })
  })

  router.post('/avatar', isLoggedIn, function (req, res) {

    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).send('No files were uploaded.');
    }

    const avatar = req.files.avatar;
    const fileName = `${Date.now()}-${avatar.name}`
    const uploadPath = path.join(__dirname, '..', 'public', 'images', 'avatar', fileName)

    // Use the mv() method to place the file somewhere on your server
    avatar.mv(uploadPath, function (err) {
      if (err){
        return res.redirect('/avatar')
      }
        
      db.query('UPDATE users SET avatar = $1 WHERE id = $2', [fileName, req.session.user.id]).then(() => {
        req.session.user.avatar = fileName
        res.redirect('/todos');
      }).catch((err)=>{
        res.send(err.message)
      })
    });
  })

  return router;
}
