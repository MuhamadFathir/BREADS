var express = require('express');
const { isLoggedIn } = require('../helper/util');
var router = express.Router();
const moment = require('moment');

module.exports = function (db) {
  router.get('/', isLoggedIn, async function (req, res, next) {
    try {
      const { page = 1,
        title,
        deadline1,
        deadline2,
        complete,
        operation,
        sortMode = 'asc',
        sortBy = 'id'
      } = req.query;

      const url = req.url == '/' ? `/?page=${page}&sortBy=${sortBy}&sortMode=${sortMode}` : req.url;
      const limit = 5;
      const offset = limit * (page - 1);

      const userId = req.session.user.id;
      let queries = []
      let filter = `userid = ${userId}`

      if (title) {
        queries.push(`title ILIKE '%${title}%'`);
      }

      if (complete === 'true') {
        queries.push(`complete = true`);
      } else if (complete === 'false') {
        queries.push(`complete = false`);
      }

      if (deadline1 && deadline2) {
        queries.push(`deadline BETWEEN '${deadline1}' AND '${deadline2}'`);
      } else if (deadline1) {
        queries.push(`deadline >= '${deadline1}'`);
      } else if (deadline2) {
        queries.push(`deadline <= '${deadline2}'`);
      }


      let whereClause = 'WHERE todos.' + filter;
      if (queries.length > 0) {
        const op = operation?.toUpperCase() === 'OR' ? 'OR' : 'AND';
        whereClause += ` AND (${queries.join(` ${op} `)})`;
      }
      let sql = `
      SELECT todos.id, todos.title, todos.deadline, todos.complete
      FROM todos LEFT JOIN users ON todos.userid = users.id
      ${whereClause}
      ORDER BY ${sortBy} ${sortMode}
      LIMIT ${limit} OFFSET ${offset}
      `;
      console.log(sql)

      let sqlcount = `
        SELECT COUNT(*) AS total
        FROM todos LEFT JOIN users ON todos.userid = users.id
        ${whereClause}
      `;


      const todosCount = await db.query(sqlcount);
      const pages = Math.ceil(todosCount.rows[0].total / limit);

      const todos = await db.query(sql);

      const formattedTodos = todos.rows.map(todo => ({
        ...todo,
        formattedDeadline: moment(todo.deadline).format('DD MMM YYYY HH:mm')
      }));


      res.render('todos/list', {
        todos: formattedTodos,
        query: req.query,
        offset,
        page,
        url,
        pages,
        user: req.session.user,
        title: 'List Todos',
        sortBy,
        sortMode,
        moment
      });
    } catch (error) {
      console.log(error);
      res.send('Gagal load data todos');
    }
  });

  router.get('/add', isLoggedIn, async function (req, res) {
    res.render('todos/add', { data: {}, user: req.session.user, title: 'Add Data' })
  })

  router.post('/add', isLoggedIn, async function (req, res) {
    try {
      const { title } = req.body;

      await db.query('INSERT INTO todos (title, userid) VALUES ($1, $2)', [title, req.session.user.id]);

      res.redirect('/todos');
    } catch (error) {
      console.log(error);
      res.render('todos/add', { data: req.body, user: req.session.user, error: 'Gagal menambahkan todo.' });
    }
  });

  router.get('/edit', isLoggedIn, async function (req, res) {
    try {
      const { id } = req.query;
      const userId = req.session.user.id;

      const result = await db.query('SELECT * FROM todos WHERE id = $1 AND userid = $2', [id, userId]);

      if (result.rows.length === 0) {
        return res.send('Todo tidak ditemukan atau bukan milik Anda.');
      }

      const todo = result.rows[0];
      todo.deadline = moment(todo.deadline).format('YYYY-MM-DDTHH:mm');

      res.render('todos/edit', {
        data: todo,
        user: req.session.user,
        title: 'Edit Data',
        moment
      });
    } catch (error) {
      console.log(error);
      res.send('Gagal mengambil data todo untuk diedit.');
    }
  });

  router.post('/edit', isLoggedIn, async function (req, res) {
    try {
      const { title, deadline, complete } = req.body;
      const { id } = req.query
      const userid = req.session.user.id

      await db.query('UPDATE todos SET title = $1, deadline = $2, complete = $3 WHERE id = $4 AND userid = $5', [title, deadline, complete == 'on', id, userid]);

      res.redirect('/todos');
    } catch (error) {
      console.log(error);
      res.render('todos');
    }
  });

  router.get('/delete', isLoggedIn, async function (req, res) {
    try {
      const { id } = req.query
      const userId = req.session.user.id;

      await db.query('DELETE FROM todos WHERE id = $1 AND userid = $2', [id, userId]);

      res.redirect('/todos');

    } catch (error) {
      res.send('Gagal Menghapus todo')
    }

  })



  return router;
};
