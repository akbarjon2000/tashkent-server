// const menu = require("./routes/menu")
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const bcrypt = require("bcryptjs");
const express = require("express");
const router = express.Router();
const app = express();
const { v4: uuidv4 } = require('uuid');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const jwt = require("jsonwebtoken");
const saltRounds = 10;
const Multer = require("multer")
const cors = require("cors")
// const path= require("path");

//Google cloud:
const {Storage, TransferManager} = require('@google-cloud/storage')
const storage = new Storage({
    projectId:"uplifted-scout-400906",
    keyFilename:"my_key.json"
});
const bucket = storage.bucket("tashkent");

// const transferManager = new TransferManager(storage.bucket(bucketName));

//Mongo db
const uri = "mongodb+srv://akbarjon:simple200@restaurant.tioljbn.mongodb.net/?retryWrites=true&w=majority&appName=AtlasApp";
const client = new MongoClient(uri);

// COLLECTIONS:

let menu;
let cart;
let orderList;
let users;
let tables;
let likes;
let reviews;

client.connect()
    .then(() => {
        console.log('Connected to MongoDB');
        const database = client.db("Tashkent");
        menu = database.collection("menu");
        cart = database.collection("cart");
        orderList = database.collection("order_list");
        users = database.collection("users");
        tables = database.collection("tables");
        likes = database.collection("likes");
        reviews = database.collection("reviews");
        // console.log(menu)
    })
    .catch(err => {
        console.error('Error connecting to MongoDB', err);
    });
//Multer:

const multer = Multer({
    storage:Multer.memoryStorage(),
    limits:{
        fileSize: 5*1024*1024, //5mb
    }
})

app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));

// MENU
app.post("/menu", async (req, res) => {
    const {token} = req.body;
    console.log("Inside /menu route");
    try {
        let decode = jwt.verify(token, "my_client_id");

        let items = await menu.aggregate([
            {
              $lookup: {
                from: "likes",
                let: { menuId: { $toString: "$_id" } },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ["$$menuId", "$item"] },
                          { $eq: ["$client_id", decode.client_id] } // Replace with the actual client_id
                        ]
                      }
                    }
                  }
                ],
                as: "likes"
              }
            },
            {
              $addFields: {
                liked: {
                  $cond: {
                    if: { $gt: [{ $size: "$likes" }, 0] }, // Check if the array is not empty
                    then: true,
                    else: false
                  }
                }
              }
            },
            {
              $project: {
                likes: 0 // Exclude the 'likes' array from the final result if not needed
              }
            }
          ]).toArray();
          res.send(items)
    } catch (err) {
        res.status(500).send({ message: 'Error fetching MENU', err });
    }
});

app.post("/get-dish", async (req, res) => {
    const {dish_id} = req.body;
    let objectId = new ObjectId(dish_id);
    try {
        console.log("get-dish requested");
        let result = await menu.findOne({_id:objectId});
        res.send(result)
    } catch (error) {
        res.status(409).send(error)
    }
})

//CART ACTIONS
app.post("/cart", async (req, res) => {
    console.log("get cart requested")
    const {token} = req.body;
    let decode = jwt.verify(token, "my_client_id");
    try {
        const items = await cart.find({client_id:decode.client_id}).toArray();
        res.send(items);
    } catch (error) {
        res.status(500).send("Error coming from CART:", error);
    }
    
})
app.post("/add", async (req, res) => {
    console.log(req.body);
    const {_item, count, token} = req.body;
    const {name, _id, image, price} = _item;
    try{
        let decode = jwt.verify(token, "my_client_id");
        await cart.insertOne({client_id:decode.client_id, item:{name, _id, price, image}, count });
        res.status(200).send("Success")
    }catch(err){
        res.status(500).send({message:"Error is coming from Cart:", err})
    }
});

app.delete("/delete-cart-item", async (req, res) => {
    console.log("delete cart item requested!")
    const {_id, client_id} = req.body;
    let objectId = new ObjectId(_id);
    console.log(objectId);
    try {
        // let client_id = jwt.decode(token, "my_client_id");
        const result = await cart.deleteOne({_id:objectId});
        console.log(result);
        res.send("Item successfully deleted!");
    } catch (error) {
        res.status(409).send(error);
    }
})

app.delete("/delete-all-cart-items", async (req, res) => {
    console.log("delete all cart items requested!")
    const {token, order} = req.body;
    try {
        let decode = jwt.verify(token, "mt_client_id");
        await cart.deleteMany({client_id:decode.client_id})
        await orderList.insertOne({order});
        res.send("Item successfully deleted!");
    } catch (error) {
        
    }
})
app.put("/update-cart-item", async (req, res) => {
    const {count, item_id, client_id} = req.body;
    try {
        const updated_item = await cart.updateOne({item_id, client_id}, {$set:{count}})
        res.send(updated_item);
    } catch (error) {
        console.log(error);
    }
})


//CART FINISH;

//SIGNUP:
app.post("/sign-up", async (req, res) => {
    const {first_name, last_name, number, email, password} = req.body.form;
    let user = await users.findOne({email});
    if(!user){

    let client_id = uuidv4();
    bcrypt.hash(password, saltRounds, async function(err, hash) {
        try {
            const result = await  users.insertOne({
                client_id,
                first_name, 
                last_name,
                number, 
                email,
                password:hash
            })
            let success = {
                result,
                client_id
            }
            res.cookie('clientId', client_id, { maxAge: 86400000, httpOnly: true }); // maxAge is in milliseconds (1 day in this example)
            res.send(success);
        } catch (error) {
            res.send(error);
        }
    });
    }else{
        res.status(409).json({ error: 'Email is already in use' });
    }

})
app.post("/auth", async (req, res) => {
    let {auth} = req.body
    if(auth){
        let decode = jwt.verify(auth, "my_client_id");;
        console.log(decode.client_id);
        let user = users.findOne({client_id:decode.client_id})
        if(user){
            res.send(true);
        }else{
            res.send(false);
        }
    }else{
        res.send(false)
    }
    
})
app.post("/sign-in", async (req, res) => {
        const {email, password} = req.body;
        // console.log(password)
        let user = await users.findOne({email});
        if(bcrypt.compareSync(password, user.password)){
            let token = jwt.sign({client_id:user.client_id},"my_client_id");
            res.send(token);
        }else{
            console.log("second else");
            res.send(false);
        }
})

const port = process.env.PORT || 3001;
app.listen(port, () => {
    console.log("listenig on port:", port);
})
//SIGN UP END

//PROFILE:

app.post("/get-profile", async (req, res) => {
    console.log("get-profile-rout")
    let token = req.body.decode;
    let decode = jwt.verify(token, "my_client_id");
    let user = await users.findOne({client_id:decode.client_id});
    if(user){
        delete user.password;
        res.send(user);
    }else{
        res.status(404).send("User not found");
    }
})

app.put("/update-profile", async (req, res) => {
    try {
        let data = req.body.profile;
        let user = await users.findOne({client_id:data.client_id});
        bcrypt.compare(data.password, user.password, async function(err, result) {
            if(result){
                let update_res = await users.updateOne({client_id:data.client_id}, {$set:{
                    first_name:data.first_name,
                    last_name:data.last_name,
                    email:data.email,
                    number:data.number
                }})
                res.send(update_res);
            }else{
                res.status(409).json({ err});
            }
        });
    } catch (error) {
        res.status(409).json({ error});

    }
})

// PROFILE END.


//TABLE:

app.post("/book-table", async (req, res) => {
    try {
        const {table, token} = req.body;
        let decode = jwt.verify(token, "my_client_id");
        let response = await tables.insertOne({
            count:table.count,
            date:table.date,
            time:table.time,
            type:table.type,
            client_id:decode.client_id
        })
        res.send(response);
    } catch (error) {
        res.status(409).send("BOOK TABLE ERROR:", error);
    }
});

app.post("/get-tables", async(req, res) => {
    const {token} = req.body;
    
    try {
        let decode = jwt.verify(token, "my_client_id");
        let result =await tables.find({client_id:decode.client_id}).toArray();
        res.send(result);
    } catch (error) {
        res.status(409).send(error);
    }
})

app.delete("/delete-table", async (req, res) => {
    try {
        console.log("Deleting table")
        const {_id} = req.body;
        let objectId = new ObjectId(_id);
        // const objectId = new require("mongodb").ObjectId(_id)
        console.log(_id);
        const result = await tables.deleteOne({_id:objectId});
        res.send(result);
        
    } catch (error) {
        res.status(409).send(error);
    }
})

//Wishlist:

app.post("/like", async (req, res) => {
    try{
        const {_id, token} = req.body;
        const decode = jwt.verify(token, "my_client_id");
        let result = await likes.insertOne({item:_id, client_id:decode.client_id});
        res.send(result);

    }catch(error){
        res.status(409).send(error);
    }
})

app.post("/get-likes", async (req, res) => {
    try {
        const {token} = req.body;
        let decode = jwt.verify(token, "my_client_id");
        const client_id = decode.client_id;
        console.log(client_id)
        let result = await menu.aggregate([
            {
              $lookup: {
                from: "likes",
                let: { menuId: { $toString: "$_id" } },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ["$$menuId", "$item"] },
                          { $eq: ["$client_id", client_id] }
                        ]
                      }
                    }
                  }
                ],
                as: "wishlist"
              }
            },
            {
              $unwind: "$wishlist"
            },
            {
              $project: {
                _id: 1,
                name: 1,
                description_uz: 1,
                description_kor: 1,
                description_eng: 1,
                image:1,
                price:1
                // Add other fields from the 'menu' collection as needed
              }
            }
          ]).toArray();

        res.send(result);
    } catch (error) {
        res.status(501).send(error)
    }
});

app.delete("/dislike", async (req, res) => {
    try {
        const {token, id} = req.body;
        let decode = jwt.verify(token, "my_client_id");
        let result = await likes.deleteOne({client_id:decode.client_id, item:id});
        res.send(result);
    } catch (error) {
        res.status(409).send(error);
    }
})

//Rewies:

app.post("/upload-image",multer.single('imgfile'),  async (req, res) => {
    console.log("upload requested")
    try {
        if(req.file){
            console.log("preparing the image")
            const blob = bucket.file(req.file.originalname)
            const blobStream = blob.createWriteStream();

            blobStream.on('finish', () => {
                console.log(blob.metadata.mediaLink)
                res.status(200).send(blob.metadata.mediaLink);
            })
            blobStream.end(req.file.buffer);
        }
        
    }catch (error) {
        res.status(409).send(error)
    }
})

app.post("/upload-review", async (req, res) => {
    console.log("upload-review requested")
    const {image, dish_id, review, rating, token} = req.body;
    let decode =jwt.verify(token, "my_client_id");
    try {
        let date = Date.now()
        let review_  = await reviews.insertOne({
            image,
            dish_id,
            review, 
            rating,
            client_id:decode.client_id,
            created_at: date
        })
        res.send(review_)
    } catch (error) {
        res.status(409).send(error);
    }
})

app.get("/get-reviews", async (req, res) => {
    try{
        let result = await reviews.aggregate([
            {
              $lookup: {
                from: "users",
                localField: "client_id",
                foreignField: "client_id",
                as: "user_info"
              }
            },
            {
              $unwind: "$user_info"
            },
            {
              $project: {
                _id: 0,
                review_details: "$$ROOT",
                user_info: {
                  first_name: 1,
                  last_name: 1
                }
              }
            }
          ]).toArray()
          res.send(result);
    }catch(error){
        res.status(409).send(error)
    }
})