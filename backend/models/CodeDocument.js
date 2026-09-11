const mongoose = require("mongoose");

const codeDocumentSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      index: true,
    },

    fileName: {
      type: String,
      required: true,
    },

    content: {
      type: String,
      default: "",
    },

    language: {
      type: String,
      default: "javascript",
    },

    updatedBy: {
      type: String,
      default: null,
    },
    yjsState: {
    type: Buffer,
    default: null,
},
  },
  {
    timestamps: true,
  }
);

codeDocumentSchema.index(
  { roomId: 1, fileName: 1 },
  { unique: true }
);

module.exports = mongoose.model("CodeDocument", codeDocumentSchema);