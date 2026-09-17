const express = require("express");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");

const router = express.Router();

const LANGUAGE_MAP = {
  "C++": "cpp",
  "C": "c",
  "Python": "python",
  "Java": "java",
  "Go": "go",
  "Rust": "rust",
};

function runCommand(command, args, cwd, timeout = 10000) {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      {
        cwd,
        timeout,
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          resolve({
            success: false,
            output: stderr || stdout || error.message,
          });
          return;
        }

        resolve({
          success: true,
          output: stdout || stderr || "Program executed successfully.",
        });
      }
    );
  });
}

router.post("/execute", async (req, res) => {
  const { language, code } = req.body;

  if (!language || typeof code !== "string") {
    return res.status(400).json({
      success: false,
      output: "Language and code are required.",
    });
  }

  const normalizedLanguage = LANGUAGE_MAP[language];

  if (!normalizedLanguage) {
    return res.status(400).json({
      success: false,
      output: `Execution is not supported for ${language}.`,
    });
  }

  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "syncspace-")
  );

  try {
    let sourceFile;
    let result;

    // =========================
    // C++
    // =========================
    if (normalizedLanguage === "cpp") {
      sourceFile = path.join(tempDir, "main.cpp");
      const executable = path.join(tempDir, "main.exe");

      fs.writeFileSync(sourceFile, code, "utf8");

      const compileResult = await runCommand(
        "g++",
        [sourceFile, "-o", executable],
        tempDir
      );

      if (!compileResult.success) {
        return res.json({
          success: false,
          output: compileResult.output,
        });
      }

      result = await runCommand(
        executable,
        [],
        tempDir
      );

      return res.json(result);
    }

    // =========================
    // C
    // =========================
    if (normalizedLanguage === "c") {
      sourceFile = path.join(tempDir, "main.c");
      const executable = path.join(tempDir, "main.exe");

      fs.writeFileSync(sourceFile, code, "utf8");

      const compileResult = await runCommand(
        "gcc",
        [sourceFile, "-o", executable],
        tempDir
      );

      if (!compileResult.success) {
        return res.json({
          success: false,
          output: compileResult.output,
        });
      }

      result = await runCommand(
        executable,
        [],
        tempDir
      );

      return res.json(result);
    }

    // =========================
    // Python
    // =========================
    if (normalizedLanguage === "python") {
      sourceFile = path.join(tempDir, "main.py");

      fs.writeFileSync(sourceFile, code, "utf8");

      result = await runCommand(
        "python",
        [sourceFile],
        tempDir
      );

      return res.json(result);
    }

    // =========================
    // Java
    // =========================
    if (normalizedLanguage === "java") {
      sourceFile = path.join(tempDir, "Main.java");

      fs.writeFileSync(sourceFile, code, "utf8");

      const compileResult = await runCommand(
        "javac",
        [sourceFile],
        tempDir
      );

      if (!compileResult.success) {
        return res.json({
          success: false,
          output: compileResult.output,
        });
      }

      result = await runCommand(
        "java",
        ["-cp", tempDir, "Main"],
        tempDir
      );

      return res.json(result);
    }

    // =========================
    // Go
    // =========================
    if (normalizedLanguage === "go") {
      sourceFile = path.join(tempDir, "main.go");

      fs.writeFileSync(sourceFile, code, "utf8");

      result = await runCommand(
        "go",
        ["run", sourceFile],
        tempDir
      );

      return res.json(result);
    }

    // =========================
    // Rust
    // =========================
    if (normalizedLanguage === "rust") {
      sourceFile = path.join(tempDir, "main.rs");
      const executable = path.join(tempDir, "main.exe");

      fs.writeFileSync(sourceFile, code, "utf8");

      const compileResult = await runCommand(
        "rustc",
        [sourceFile, "-o", executable],
        tempDir
      );

      if (!compileResult.success) {
        return res.json({
          success: false,
          output: compileResult.output,
        });
      }

      result = await runCommand(
        executable,
        [],
        tempDir
      );

      return res.json(result);
    }

  } catch (error) {
    console.error("Code execution error:", error);

    return res.status(500).json({
      success: false,
      output: error.message,
    });

  } finally {
    try {
      fs.rmSync(tempDir, {
        recursive: true,
        force: true,
      });
    } catch (cleanupError) {
      console.error("Cleanup error:", cleanupError);
    }
  }
});

module.exports = router;