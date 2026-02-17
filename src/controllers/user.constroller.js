import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import {User} from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { apiResponse } from "../utils/apiResponse.js";
import jwt from 'jsonwebtoken';
import mongoose from "mongoose";

const generateAccessAndRefreshTokens = async(userId) => 
{
    try{
        const user = await User.findById(userId);
        const accessToken = user.generateAccessTokens();
        const refreshToken = user.generateRefreshTokens(); 
        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return {accessToken, refreshToken};

    }catch{
        throw new ApiError(500,"Something Went Wrong While Generating Refresh and Access Tokens")
    }
}

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

const loginUser = asyncHandler(async (req,res) => {
    //take the username ans password from user    //req->body data
    //validate in mongoo db                       //username or email
    // if is correct generate a refresh token and access token             // fins the user
    // save in the cookie of user                  // password check
    // each an d evry request is valid via access token                //refresh and accss token
    //                                                          //send cookie

    const {email,username,password} = req.body;
    if (!username && !email){
        throw new ApiError(400,"Username or email is required");
    }
    const user = await User.findOne({
        $or:[{username},{email}]
    })

    if (!user){
        throw new ApiError(404,"User Does Not Exist");
    }

    const isPasswordValid = await user.isPasswordCorrect(password)
    if (!isPasswordValid){
        throw new ApiError(401,"Credentials are Incorrect")
    }

    const  {accessToken,refreshToken}= await generateAccessAndRefreshTokens(user._id);

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    const options = {
        httpOnly:true,
        secure:true
    }

    return res.status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new apiResponse(200,{
            user:loggedInUser,accessToken,refreshToken
        },"User Logged In Successfully"
    )
)
}) 

const logoutUser = asyncHandler(async(req,res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                refreshToken:"" 
            }
        },
        {
            new:true  // gives the updated value in response
        }
    )

    const options = {
        httpOnly:true,
        secure:true
    }
    return res.status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new apiResponse(200,{},`User Logged Out ${req.user?._id}`))
})

const refreshAccessToken = asyncHandler(async(req,res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;
    if (!incomingRefreshToken){
        throw new ApiError
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken,process.env,REFRESH_TOKEN_SECRET);
    
        const user = await User.findById(decodedToken?._id);
    
        if (!user){
            throw new ApiError(401,"Invalid Refresh Token")
        }
    
        if (incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401,"Refresh Token if Expired Or Used")
        }
    
        const options={
            httpOnly:true,
            secure:true
        }
    
        const {accessToken,newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",newRefreshToken,options)
        .json(
            new apiResponse(200,{
                 accessToken,
                 refreshToken:newRefreshToken
            },"Access Token Refreshed")
        )
    } catch (error) {
        throw new ApiError(401,error?.message || "Invaid Refresh Token")
    }
})

const changeCurrentPassword = asyncHandler(async(res,req) => {
    const {oldPassword, newPassword} = req.body;
    const user = await User.findById(req.user._id);
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
    if (!isPasswordCorrect){
        throw new ApiError(400,"Invalid Old Password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave:false}) 

    return res
    .status(200)
    .json(new apiResponse(200,{},"Password Changed Successfully")) 
})

const getCurrentUser = asyncHandler(async(req,res) => {
    return res
    .status(200)
    .json(new apiResponse(200,req.user,"Current User fetched Successfully")) 
})

const updateAccountDetails = asyncHandler(async(req,res) => {
    const {fullname, email} = req.body

    if (!fullname || !email){
        throw new ApiError(400,"All Fileds Are Required")
    }

    const user = await User.findByIdAndUpdate(req.user?._id,
        {
            $set:{
                fullname,
                email
            }
        },
        {new:true}
    ).select("-password")

    return res
    .status(200)
    .json(new apiResponse(200,user,"Account Details Updated Successfully"))
})

const updateUserAvatar = asyncHandler(async(req,res) => {
    const avatarLocalPath = req.file?.path

    if (!avatarLocalPath){
        throw new ApiError(400,"Avatar File Is Missing")
    }
    
    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if (!avatar.url){
        throw new ApiError(400,"Error While Uploading the Avatar")
    }

    const user = await User.findByIdAndUpdate(req.user?._id,
        {
            $set:{
                avatar:avatar.url 
            }
        },
        {new:true}
    ).select("-password")

    return res
    .status(200,
        user,
        "Avatar Updated Successfully"
    )
})

const updateUserCoverImage = asyncHandler(async(req,res) => {
    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath){
        throw new ApiError(400,"Cover Image File Is Missing")
    }
    
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!coverImage.url){
        throw new ApiError(400,"Error While Uploading the Cover Image")
    }

    const user = await User.findByIdAndUpdate(req.user?._id,
        {
            $set:{
                coverImage:coverImage.url 
            }
        },
        {new:true}
    ).select("-password")

    return res
    .status(200,
        user,
        "Cover Image Updated Successfully"
    )
})

const getUserChannelProfile = asyncHandler(async(req,res) => {
    const {username} = req.params;

    if (!username?.trim()){
        throw new ApiError(400,"Username is missing")
    }
    
    const channel = await User.aggregate([{
        $match:{
            username:username?.lowercase()
        }
    },{
        $lookup:{
            from:"subscriptions",
            localField:"_id",
            foreignField:"channel",
            as:"subscribers"
        }
    },{
        $lookup:{
            from:"subscriptions",
            localField:"_id",
            foreignField:"subscriber",
            as:"subscribedTo"
        }
    },{
        $addFields:{
            subscribersCount:{
                $size:"$subscribers"
            },
            channelSubscribedToCount:{
                $size:"$subscribedTo"    
            },
            isSubscribed:{
                $cond:{
                    if:{$in:[req.user?._id,"$subscribers.subscriber"]},
                    then:true,
                    else:false
                }
            }
        }
    },{
        $project:{
            fullname:1,
            username:1,
            subscribersCount:1,
            channelSubscribedToCount:1,
            isSubscribed:1,
            avatar:1,
            coverImage:1,
            email:1,

        }
    }])

    if (!channel?.length){
        throw new ApiError(404,"Channel Does Not Exist");
    }

    return res
    .status(200)
    .json(new apiResponse(200,channel[0],"User Channel Fetched Successfully"));
})

const getWatchHistory = asyncHandler(async (req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "Video",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner:{
                                $first:"$owner"
                            }
                        }
                    }
                ]
            }
        }
    ]);
    res
    .status(200)
    .json(new apiResponse(200, user[0]?.watchHistory || [], "Watch history fetched successfully"));
});

export { registerUser,
         loginUser,
         logoutUser,
         refreshAccessToken,
         changeCurrentPassword,
         getCurrentUser,
         updateAccountDetails,
         updateUserAvatar,
         updateUserCoverImage,
         getUserChannelProfile,
         getWatchHistory,
}