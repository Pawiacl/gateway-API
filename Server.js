const express = require("express");
const path = require("path");
const dotenv = require("dotenv");
const cors = require("cors");

dotenv.config({
  path: path.join(__dirname, ".env"),
});

const router = express.Router();
const app = express();

app.use(cors());
app.use(express.json());

// ===============================
// SERVICE REGISTRY
// ===============================

const SERVICE_REGISTRY = Object.entries({
  registration: process.env.REGISTRATION_SERVICE_URL,
  login: process.env.LOGIN_SERVICE_URL,
  userTypes: process.env.USER_TYPE_SERVICE_URL,
  classes: process.env.CLASS_SERVICE_URL,
  subjects: process.env.SUBJECT_SERVICE_URL,
  "data-grid": process.env.DATA_GRID_SERVICE_URL,
  students: process.env.STUDENT_SERVICE_URL,
  email: process.env.EMAIL_SERVICE_URL,
  attendance: process.env.ATTENDANCE_SERVICE_URL,
  classTeachers: process.env.CLASS_TEACHER_SERVICE_URL,
  syllabus: process.env.SYLLABUS_SERVICE_URL,
  exams: process.env.EXAM_SERVICE_URL,
  results: process.env.RESULT_SERVICE_URL,
  files: process.env.FILE_SERVICE_URL,
  "exam-types": process.env.EXAMTYPE_SERVICE_URL,
  // marks: process.env.MARKS_SERVICE_URL,
}).reduce((services, [name, url]) => {
  if (url) {
    services[name] = url.replace(/\/+$/, "");
  }

  return services;
}, {});

// ===============================
// SERVICE HEALTH
// ===============================

function getServiceHealth() {
  return Object.fromEntries(
    Object.entries(SERVICE_REGISTRY).map(
      ([name, url]) => [
        name,
        {
          url,
          status: "active",
        },
      ]
    )
  );
}

// ===============================
// GET TARGET URL
// ===============================

function getTargetUrl(serviceName, req) {
  const baseUrl = SERVICE_REGISTRY[serviceName];

  console.log("baseUrl:", baseUrl);

  if (!baseUrl) {
    throw new Error(
      `Unknown service: ${serviceName}`
    );
  }

  // Keep the complete API path
  const routePath = req.originalUrl;

  console.log("routePath:", routePath);

  return `${baseUrl}${routePath}`;
}

// ===============================
// PROXY REQUEST TO SERVICE
// ===============================

async function proxyToService(
  serviceName,
  req,
  res
) {
  const targetUrl = getTargetUrl(
    serviceName,
    req
  );

  console.log("targetUrl:", targetUrl);

  try {
    // ===============================
    // CONTENT TYPE
    // ===============================

    const contentType =
      req.headers["content-type"] || "";

    // ===============================
    // MULTIPART CHECK
    // ===============================

    const isMultipart =
      contentType.includes(
        "multipart/form-data"
      );

    // ===============================
    // REQUEST HEADERS
    // ===============================

    const headers = {
      ...(req.headers.authorization
        ? {
            Authorization:
              req.headers.authorization,
          }
        : {}),
      ...(req.headers["content-type"]
        ? {
            "Content-Type":
              req.headers["content-type"],
          }
        : {}),
    };

    // ===============================
    // REQUEST BODY
    // ===============================

    let body;

    if (
      ["GET", "HEAD"].includes(req.method)
    ) {
      body = undefined;
    } else if (isMultipart) {
      // File upload request
      body = req;
    } else {
      // Normal JSON request
      headers["Content-Type"] =
        "application/json";

      body = JSON.stringify(
        req.body ?? {}
      );
    }

    // ===============================
    // SEND REQUEST TO SERVICE
    // ===============================

    const response = await fetch(
      targetUrl,
      {
        method: req.method,
        headers,
        body,
        ...(isMultipart
          ? {
              duplex: "half",
            }
          : {}),
      }
    );

    // ===============================
    // RESPONSE
    // ===============================

    const text =
      await response.text();

    res.status(response.status);

    if (text) {
      res.send(text);
    } else {
      res.end();
    }
  } catch (error) {
    // ===============================
    // ERROR LOG
    // ===============================

    console.error(
      `Proxy Error (${serviceName}):`,
      error
    );

    console.error(
      "Error Name:",
      error.name
    );

    console.error(
      "Error Message:",
      error.message
    );

    console.error(
      "Error Cause:",
      error.cause
    );

    // ===============================
    // ERROR RESPONSE
    // ===============================

    res.status(502).json({
      status: "error",
      message:
        `Failed to proxy request to ${serviceName}`,
      details: error.message,
      cause:
        error.cause?.message || null,
    });
  }
}

// ===============================
// SERVICE ROUTE
// ===============================

router.all(
  "/:service",
  (req, res) => {
    const serviceName =
      req.params.service;

    if (
      !SERVICE_REGISTRY[serviceName]
    ) {
      return res.status(404).json({
        status: "error",
        message:
          `Service '${serviceName}' is not registered in the gateway`,
      });
    }

    return proxyToService(
      serviceName,
      req,
      res
    );
  }
);

// ===============================
// SERVICE ROUTE WITH PATH
// ===============================

router.all(
  "/:service/*path",
  (req, res) => {
    const serviceName =
      req.params.service;

    if (
      !SERVICE_REGISTRY[serviceName]
    ) {
      return res.status(404).json({
        status: "error",
        message:
          `Service '${serviceName}' is not registered in the gateway`,
      });
    }

    return proxyToService(
      serviceName,
      req,
      res
    );
  }
);

// ===============================
// HEALTH CHECK
// ===============================

router.get(
  "/health",
  (req, res) => {
    res.json({
      status: "ok",
      services:
        getServiceHealth(),
    });
  }
);

// ===============================
// API ROUTER
// ===============================

app.use("/api", router);

// ===============================
// START SERVER
// ===============================

if (require.main === module) {
  const port = Number(
    process.env.PORT || 5000
  );

  app.listen(port, () => {
    console.log(
      `Gateway running on port ${port}`
    );

    console.log(
      "Registered services:",
      Object.keys(
        SERVICE_REGISTRY
      )
    );
  });
}

// ===============================
// EXPORT
// ===============================

module.exports = {
  app,
  router,
};

