const express = require('express')
const app = express()
const port = 3000

const processoRoute = require("./routes/processo")

app.use(express.json());

app.use('/api', processoRoute);

app.get("/", (req, res) => {
    res.send("Joinha!");
})

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
})