
import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    username:{
        type:String,
        required: true
    },
    email:{
        type: String,
        required: true,
    },
    password:{
        type: String,
        required: true
    },
    address:{
        type: String
    },
    phoneNumber:{
        type: String,
        required: true
    },
    role:{
        type: String,
        enum: ['Buyer','Seller','Admin'],
        default: 'Customer',
        required: true
    }

});

const User = mongoose.model('User',userSchema);
export default User;