//require ('dotenv') .config({path:'./env'})

import dotenv from 'dotenv'
import connectDB from "./db/index.js";
import { app } from './app.js';

dotenv.config({
    path:'./env'
})

connectDB()
.then(() => {
    const port = process.env.PORT || 8000;
    app.listen(port, () => {
        console.log(`Server is Running at ${port}`)
    })
})
.catch((error) => {
    console.log("Mongo DB Connection Failed!! ",error)
})













/*
import express from 'express';
const app = express();

( async () => {
    try{
        await mongoose.connect(`${process.env.NGODB_URL}/${DB_NAME}`);
        app.on("error", (error) => {
            console.log("Error:- ",error)
            throw error
        })
        app.listen(process.env.PORT  ,() => {
            console.log(`App is listening on port ${process.env.PORT}`); 
        })
    }catch(error){
        console.error("Error:- ",error);
        throw error
    }
})()

*/