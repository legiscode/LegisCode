const express = require("express");
const bodyParser = require("body-parser");
const Laws = require("./Laws.js");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const nodemailer = require("nodemailer");
var smtpTransport = require("nodemailer-smtp-transport");
const { MongoClient, ObjectId } = require("mongodb");
const PORT = process.env.PORT || 8000;

const app = express();

//Middlewares
const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.json());

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res
      .status(400)
      .json({ error: "Multer error", message: err.message });
  }
  if (err) {
    return res
      .status(500)
      .json({ error: "Internal server error", message: err.message });
  }
  next();
});

// --------------Multer Configuration------------------------------

const storage = multer.diskStorage({
  destination: function (req, res, cb) {
    return cb(null, "./uploads");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + "." + file.mimetype.split("/")[1]
    );
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only images are allowed."));
    }
  },
});

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// -----------------------------------------------------------------

// -----------------------------MongoDb Database Connection----------

const URL =
  "mongodb+srv://prasaddurga2031:2giHZWwfmqEO4HwR@cluster0.6wi8ndo.mongodb.net/?retryWrites=true&w=majority";

async function connectToDB() {
  try {
    const client = new MongoClient(URL, { useUnifiedTopology: true });
    await client.connect();
    const db = client.db("blogs");
    console.log("Connected");
    return db;
  } catch (error) {
    console.error("Error connecting to the database:", error);
  }
}

// --------------------Node Mailer---------------------------------

const transporter = nodemailer.createTransport(
  smtpTransport({
    service: "Gmail",
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: "saidurga4c3@gmail.com",
      pass: "ukjb odgx mjsa kuyy",
    },
  })
);

function sendEmail(mailOptions) {
  return new Promise((resolve, reject) => {
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log("Error sending email:", error);
        reject(error);
      } else {
        console.log("Email sent:", info.response);
        resolve(info);
      }
    });
  });
}

// ---------------------------------------------------------------------

//-----------------------Laws Routes----------------------

//--getting all laws
app.get("/lawNames", (req, res) => {
  try {
    if (!Laws.Laws || !Array.isArray(Laws.Laws)) {
      throw new Error("Invalid data structure for Laws");
    }

    const lawNames = Laws.Laws.map((law) => law.name);
    res.json(lawNames);
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//--getting sections
app.get("/LawSections/:id", (req, res) => {
  let lawName = Number(req.params.id);

  let law = Laws.Laws[lawName];
  console.log(law);
  res.json(law);
});

app.get("/LawDetails", (req, res) => {
  console.log(req.query);
  let lawName = Number(req.query.law);
  let chapterIndex = Number(req.query.chapter);
  let sectionIndex = Number(req.query.section);

  let Name = Laws.Laws[lawName].name;

  let Data = Laws.Laws[lawName].Chapters[chapterIndex].sections[sectionIndex];
  let Cd = {
    name: Name,
    Data: Data,
  };
  res.json(Cd);
});

// -----------------------------------------------------------------------

// ------------------------OTP generator Route----------------------
app.get("/generateOTP", (req, res) => {
  const otp = Math.floor(1000 + Math.random() * 9000);
  console.log("OTP is " + otp.toString());

  const mailOptions = {
    from: "LegisCode",
    to: "prasaddurga2031@gmail.com",
    subject: "Login OTP",
    html: `
    <h4>OTP is ${otp}</h4>
    <br/>
    <h6>Thank you, LegisCode</h6>
    `,
  };

  sendEmail(mailOptions)
    .then(() => {
      res.json({ data: otp.toString(), status: true });
      console.error("OTP sent succesfully");
    })
    .catch((error) => {
      console.error("Error in sending emails:", error);
      res.json({ data: null, status: false });
    });
});

// -----------------------------Blog Control Routes------------------------------------

// -----------Upload Route
app.post("/uploadBlog", upload.single("image"), async (req, res) => {
  let BlogData = {
    title: req.body.title,
    desc: req.body.desc,
    image: `http://localhost:8000/uploads/${req.file.filename}`,
  };

  console.log(BlogData);

  const db = await connectToDB();
  const collection = db.collection("blogsdata");

  // Fetch the current blog data
  const currentData = await collection.find({}).toArray();

  // Prepend the new blog data to the existing data
  const newData = [BlogData, ...currentData];

  // Update the collection with the new data
  const result = await collection.deleteMany({}); // Remove all existing documents
  const insertionResult = await collection.insertMany(newData);

  console.log(result);
  console.log(insertionResult);

  res.json({
    status: "Uploaded",
    data: BlogData,
  });
});

//---------Getting Blogs------
const ITEMS_PER_PAGE = 10; // Number of blogs per page

app.get("/getBlog/:id", async (req, res) => {
  const db = await connectToDB();
  const BlogCollection = db.collection("blogsdata");
  const id = req.params.id;
  console.log(id);

  try {
    const blog = await BlogCollection.findOne({ _id: new ObjectId(id) });

    if (!blog) {
      res.status(404).json({ error: "Blog not found" });
      return;
    }
    res.json(blog);
  } catch (error) {
    console.error("Error finding blog:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/getAllBlogs/:id", async (req, res) => {
  console.log("entered");
  const db = await connectToDB();
  const BlogCollection = db.collection("blogsdata");

  // Extract page number from route parameters
  const page = parseInt(req.params.id);

  console.log(page);

  // Calculate the number of blogs to skip
  const skip = (page - 1) * ITEMS_PER_PAGE;

  // Get total count of blogs
  const totalCount = await BlogCollection.countDocuments();

  // Calculate total number of pages
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  // Fetch blogs for the requested page, sorted by createdAt in descending order (newest first)
  let BlogItems = await BlogCollection.find({})
    .skip(skip)
    .limit(ITEMS_PER_PAGE)
    .toArray();

  res.json({
    blogs: BlogItems,
    totalItems: totalCount,
    currentPage: page,
    totalPages: totalPages,
  });
});

//----------Deleting Blogs---------
app.delete("/deletecar/:id", async (req, res) => {
  const itemId = req.params.id;
  const db = await connectToDB();
  const BlogCollection = db.collection("blogsdata");
  const result = await BlogCollection.deleteOne({ _id: new ObjectId(itemId) });
  res.json(
    result.deletedCount > 0
      ? { message: "Item deleted successfully" }
      : console.log("not deleted")
  );

  //----------Modifying Blogs------------
});

// --------------------------------------------------------------------------------

app.listen(PORT, () => console.log("server started............!"));
