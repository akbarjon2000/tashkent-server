const mongodb = require("mongoose");


const  menu_schema = new mongodb.Schema({
    id:{
        type:Number,
        required:true,
    },
    name:{
        type:String,
        required:true,
        maxlength:20,
        minlength:3
    },
    description:{
        type:String,
        maxlength:50
    }
})

let Menu = mongodb.model("Menu", menu_schema)


exports.Menu = Menu;