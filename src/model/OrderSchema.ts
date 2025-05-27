// import mongoose from "mongoose";

// // Embedded schema for the shipping address
// const ShippingAddressSchema = new mongoose.Schema({
//   fullName: {
//     type: String,
//     required: true,
//     trim: true,
//   },
//   phoneNumber: {
//     type: String,
//     required: true,
//     trim: true,
//   },
//   streetAddress: {
//     type: String,
//     required: true,
//     trim: true,
//   },
//   city: {
//     type: String,
//     required: true,
//     trim: true,
//   },
// }, { _id: false }); // Disable _id for embedded schema

// const OrderSchema = new mongoose.Schema({
//   orderId: {
//     type: String,
//     required: true,
//     unique: true,
//     trim: true,
//   },
//   buyer: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true,
//   },
//   seller: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true,
//   },
//   product: {
//     productId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'Product',
//       required: true,
//     },
//     quantity: {
//       type: Number,
//       required: true,
//       min: 1,
//     },
//     price: {
//       type: Number,
//       required: true,
//     },
//   },
//   totalAmount: {
//     type: Number,
//     required: true,
//     min: 0,
//   },
//   orderStatus: {
//     type: String,
//     enum: ['Pending', 'Shipped', 'Delivered', 'Cancelled'],
//     default: 'Pending',
//   },
//   shippingAddress: {
//     type: ShippingAddressSchema,
//     required: true,
//   },
//   paymentStatus: {
//     type: String,
//     enum: ['Paid', 'Pending', 'Failed'],
//     default: 'Pending',
//   },
//   paymentMethod: {
//     type: String,
//     enum: ['Credit Card', 'Bank Transfer', 'Cash on Delivery'],
//     required: true,
//   },
//   orderDate: {
//     type: Date,
//     default: Date.now,
//   },
//   deliveryDate: {
//     type: Date,
//   },
//   transactionId: {
//     type: String,
//     unique: true,
//     sparse: true, // Allows multiple nulls
//   },
// });

// const Order = mongoose.model("Order", OrderSchema);

// export default Order;

import mongoose from "mongoose";

// Embedded schema for the shipping address
const ShippingAddressSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    trim: true,
  },
  phoneNumber: {
    type: String,
    required: true,
    trim: true,
  },
  streetAddress: {
    type: String,
    required: true,
    trim: true,
  },
  city: {
    type: String,
    required: true,
    trim: true,
  },
}, { _id: false }); // Disable _id for embedded schema

const OrderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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
    type: ShippingAddressSchema,
    required: true,
  },
  paymentStatus: {
    type: String,
    enum: ['Paid', 'Pending', 'Failed'],
    default: 'Pending',
  },
  paymentMethod: {
    type: String,
    enum: ['PayPack'],
    default: 'PayPack',
  },
  paymentChannel: {
  type: String,
  enum: ['MOMO', 'CARD', 'CASH','AITEL_MONENY'],  // add all allowed payment channels here
  required: true,
},
  paymentVerified: {
    type: Boolean,
    default: false,
  },
  paymentMetadata: {
    type: Object, // stores raw PayPack response
    default: {},
  },
  transactionId: {
    type: String,
    unique: true,
    sparse: true,
  },
  paymentTimestamp: {
    type: Date,
  },
  currency: {
    type: String,
    default: 'RWF',
  },
  orderDate: {
    type: Date,
    default: Date.now,
  },
  deliveryDate: {
    type: Date,
  },
});

const Order = mongoose.model("Order", OrderSchema);

export default Order;
