import mongoose from "mongoose";

const OrderSchema =  new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',  // Assuming the User model stores buyer data
    required: true,
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',  // Assuming the User model stores seller data
    required: true,
  },
  product: {
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  price: {
    type: Number,
    required: true,
  },
},

  totalAmount: {
    type: Number,
    required: true,
    min: 0,
  },
  orderStatus: {
    type: String,
    enum: ['Pending', 'Shipped', 'Delivered', 'Cancelled'],
    default: 'Pending',
  },
  shippingAddress: {
    type: String,
    required: true,
  },
  paymentStatus: {
    type: String,
    enum: ['Paid', 'Pending', 'Failed'],
    default: 'Pending',
  },
  paymentMethod: {
    type: String,
    enum: ['Credit Card', 'Bank Transfer', 'Cash on Delivery'],
    required: true,
  },
  orderDate: {
    type: Date,
    default: Date.now,
  },
  deliveryDate: {
    type: Date,
  },
  transactionId: {
    type: String,
    unique: true,
  },
});

const Order = mongoose.model("Order", OrderSchema);

export default Order;
