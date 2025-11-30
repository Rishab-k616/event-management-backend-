console.log("🚀 Server is starting...");

const express = require("express");
const path = require("path");
const multer = require("multer");
const { db, storageBucket } = require("./firebaseConfig");
const { getStorage, ref, uploadBytes, getDownloadURL } = require("firebase-admin/storage");

const app = express();

// Healthcheck route for Railway
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// View engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Static files (CSS, JS)
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Use memory storage instead of disk storage (serverless-compatible)
const upload = multer({ storage: multer.memoryStorage() });

// ============= ROUTES =============

// Homepage
app.get("/", async (req, res) => {
  try {
    const snapshot = await db.collection("events").get();
    const events = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    return res.status(200).render("index", { events });
  } catch (err) {
    console.error("❌ Firestore Error:", err);

    // IMPORTANT: Never return 500 here (Railway thinks the app is dead)
    return res.status(200).send("<h1>Homepage OK (Firestore unavailable)</h1>");
  }
});


// Login page
app.get("/login", (req, res) => {
  res.render("login");
});

// Admin page (load all events)
app.get("/admin", async (req, res) => {
  try {
    const snapshot = await db.collection("events").get();
    const events = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    res.render("admin", { events });
  } catch (err) {
    console.error("❌ Error loading admin page:", err);
    res.status(500).send("Error loading admin page");
  }
});

// Add Event (Uploads image to Firebase Storage)
app.post("/admin/add-event", upload.single("image"), async (req, res) => {
  try {
    const { title, description, date } = req.body;

    let imageUrl = null;

    if (req.file) {
      const storage = getStorage();
      const fileName = Date.now() + "_" + req.file.originalname;
      const storageRef = ref(storageBucket, `events/${fileName}`);

      await uploadBytes(storageRef, req.file.buffer, {
        contentType: req.file.mimetype
      });

      imageUrl = await getDownloadURL(storageRef);
    }

    await db.collection("events").add({
      title,
      description,
      date,
      image: imageUrl
    });

    console.log("✅ Event added:", title);
    res.redirect("/admin");
  } catch (error) {
    console.error("❌ Error adding event:", error);
    res.status(500).send("Error adding event");
  }
});

// Delete event
app.post("/admin/delete-event/:id", async (req, res) => {
  try {
    const id = req.params.id;
    await db.collection("events").doc(id).delete();
    console.log("🗑️ Event deleted:", id);
    res.redirect("/admin");
  } catch (error) {
    console.error("❌ Error deleting event:", error);
    res.status(500).send("Error deleting event");
  }
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

