const connection = require("../config/database");
const bcrypt = require("bcrypt");
// const express = require('express');

exports.createUser = async (req, res) => {
  const { name, age, contact, username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  connection.getConnection((err, trx) => {
    trx.beginTransaction((err) => {
      if (err) {
        throw err;
      }
      let sql1 =
        "INSERT INTO users (name, age, contact, username, password) VALUES (?,?,?,?,?);";
      let sql2 = "SELECT id from users WHERE username=?";
      trx.query(
        sql1 + sql2,
        [name, age, contact, username, hashedPassword, username],
        (err, results) => {
          if (err) {
            return trx.rollback(() => {
              res.send(err);
            });
          }
          trx.query(
            "INSERT INTO user_balance (user_id) VALUES (?)",
            [results[1][0].id],
            (err, results) => {
              if (err) {
                return trx.rollback(() => {
                  throw err;
                });
              }
              trx.commit(() => {
                if (err) {
                  return trx.rollback(() => {
                    throw err;
                  });
                }
              });
              res.send(results);
            }
          );
        }
      );
    });
  });
};

exports.loginUser = (req, res) => {
  const { username, password } = req.body;
  const responseResult = {};
  connection.query(
    `SELECT * FROM users WHERE username='${username}'`,
    async (err, result) => {
      if (!result.length) return res.send("user not found");
      try {
        if (await bcrypt.compare(password, result[0].password)) {
          const { id, username, name } = result[0];
          if (err) {
            console.log(err);
          } else {
            responseResult.id = id;
            responseResult.name = name;
            responseResult.username = username;
          }
        } else {
          return res.send("incorrect password");
        }
      } catch (error) {
        console.log(error);
      }
      connection.query(
        `SELECT * FROM user_balance WHERE user_id=?`,
        [result[0].id],
        (err, result) => {
          if (err) {
            console.log(err);
          } else {
            responseResult.balance = result[0].balance;
            res.send(responseResult);
          }
        }
      );
    }
  );
};

exports.depositMoney = (req, res) => {
  const { id, amount } = req.body;
  connection.query(
    "UPDATE user_balance SET balance=balance+? WHERE user_id=?",
    [amount, id],
    (err, result) => {
      if (err) console.log(err);
      res.send(result);
    }
  );
};

exports.transferMoney = (req, res) => {
  const { senderId, receiverUsername, amount } = req.body;

  connection.getConnection((err, trx) => {
    trx.beginTransaction((err) => {
      if (err) {
        throw err;
      }
      trx.query(
        "SELECT id FROM users WHERE username=?",
        [receiverUsername],
        (err, result) => {
          if (err) {
            return trx.rollback(() => {
              res.send(err);
            });
          }
          if (result.length == 0) {
            return res.status(404).send("user not found");
          }
          trx.query(
            "UPDATE user_balance SET balance=balance+? WHERE user_id=?",
            [amount, result[0].id],
            (err, result) => {
              if (err) {
                return trx.rollback(() => {
                  res.send(err);
                });
              }
              trx.query(
                "UPDATE user_balance SET balance=balance-? WHERE user_id=?",
                [amount, senderId],
                (err, result) => {
                  if (err) {
                    return trx.rollback(() => {
                      res.send(err);
                    });
                  }
                  trx.commit(() => {
                    if (err) {
                      return trx.rollback(() => {
                        throw err;
                      });
                    }
                  });
                  return res.send(result);
                }
              );
            }
          );
        }
      );
    });
  });
};
