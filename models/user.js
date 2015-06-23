var mongoose = require('mongoose'),
  Schema = mongoose.Schema;

var UserSchema = new Schema({
  subscriptionId: {
    type: String,
    unique: true,
    required: true
  },
  apiKey: {
    type: String,
    unique: true,
    required: true
  }
});

mongoose.model('User', UserSchema);