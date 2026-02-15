import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import {User} from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { apiResponse } from "../utils/apiResponse.js";

const registerUser = asyncHandler(async (req,res) => {
    //get user details for frontend
    //validation -- not empty
    //check if user already exist: username,email
    //check for images
    //check for avatar
    //upload them to cloudinary, avatar
    //create a user object - create entry in DB
    //remove password and refrest token field from response
    //check for user creation
    //return res
    
    const {fullname,email,username,password}  = req.body
    console.log("Email: -",email);

    if (
        [fullname,email,username,password].some((field) => field?.trim() === "")
    ){
        throw new ApiError(400,"All Fields Are Compulsary")
    }

    const existedUser = await User.findOne({
        $or:[{ username },{ email }]
    })

    if (existedUser){
        throw new ApiError(409,"User With Email or Username already exists")
    }
    
    const avatarLocalPath = req.files?.avatar[0]?.path;
    //const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path;
    }
    
    if (!avatarLocalPath){
        throw new ApiError(400,"Avatar File is Required")
    }

    console.log(avatarLocalPath);
    console.log(coverImageLocalPath);

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath) 

    if (!avatar){
        throw new ApiError(400,"Avatar File is Required")
    }

    const user = await User.create({
        fullname,
        avatar:avatar.url,
        coverImage:coverImage?.url || "",
        email,
        password,
        username:username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createdUser){
        throw new ApiError(500,"Something went wrong while registering the user")
    }

    return res.status(201).json(
        new apiResponse(200, createdUser, "User Registered Carefully ")
    )

})

export {registerUser}