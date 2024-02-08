const express = require("express");
const router = express.Router();
const { MongoClient, ServerApiVersion } = require("mongodb");
// Replace the placeholder with your Atlas connection string
const uri = "mongodb+srv://akbarjon:simple200@restaurant.tioljbn.mongodb.net/?retryWrites=true&w=majority&appName=AtlasApp";
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri);
let menu;
client.connect()
    .then(() => {
        console.log('Connected to MongoDB');
        const database = client.db("Tashkent");
        menu = database.collection("menu");
        // console.log(menu)
    })
    .catch(err => {
        console.error('Error connecting to MongoDB', err);
    });

router.get("/menu", async (req, res) => {
    console.log("Inside /menu route");
    try {
        const items = await menu.find().toArray();
        res.send(items);
    } catch (err) {
        res.status(500).send({ message: 'Error fetching data', err });
    }
});
router.get("/teest", async (req, res) => {
    res.send("test2 is working")
})

module.exports = router;