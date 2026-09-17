const express = require("express");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");

const router = express.Router();

const PISTON_LANGUAGE_CONFIG = {
  "C++": { language: "c++", version: "*", filename: "main.cpp" },
  "C": { language: "c", version: "*", filename: "main.c" },
  "Python": { language: "python", version: "*", filename: "main.py" },
  "Java": { language: "java", version: "*", filename: "Main.java" },
  "Go": { language: "go", version: "*", filename: "main.go" },
  "Rust": { language: "rust", version: "*", filename: "main.rs" },
  "TypeScript": { language: "typescript", version: "*", filename: "index.ts" },
  "JavaScript": { language: "javascript", version: "*", filename: "index.js" },
};

const LOCAL_LANGUAGE_MAP = {
  "C++": "cpp",
  "C": "c",
  "Python": "python",
  "Java": "java",
  "Go": "go",
  "Rust": "rust",
  "JavaScript": "javascript",
};

// Execute using Piston API (Online Cloud Sandbox)
async function executeWithPiston(language, code, stdin = "") {
  const config = PISTON_LANGUAGE_CONFIG[language];
  if (!config) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch("https://emkc.org/api/v2/piston/execute", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        language: config.language,
        version: config.version,
        files: [
          {
            name: config.filename,
            content: code,
          },
        ],
        stdin,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.warn("Piston API error response:", errorText);
      return null;
    }

    const data = await response.json();

    // Check compilation errors
    if (data.compile && data.compile.code !== 0) {
      return {
        success: false,
        output: data.compile.stderr || data.compile.output || "Compilation failed.",
      };
    }

    // Check runtime output
    if (data.run) {
      const isSuccess = data.run.code === 0;
      const output =
        data.run.output ||
        data.run.stdout ||
        data.run.stderr ||
        (isSuccess ? "Program executed successfully (no output)." : "Execution error.");

      return {
        success: isSuccess,
        output,
      };
    }

    return null;
  } catch (error) {
    clearTimeout(timeoutId);
    console.warn("Piston execution unavailable, falling back to local runner:", error.message);
    return null;
  }
}

// Local System Command Execution
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
          let errorMsg = stderr || stdout || error.message;
          if (error.code === "ENOENT") {
            errorMsg = `Compiler/Runtime '${command}' not found on host machine. Please install ${command} or check PATH.`;
          }
          resolve({
            success: false,
            output: errorMsg,
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

// Local Fallback Execution
async function executeLocally(language, code) {
  const normalizedLanguage = LOCAL_LANGUAGE_MAP[language];
  if (!normalizedLanguage) {
    return {
      success: false,
      output: `Execution is not supported for ${language}.`,
    };
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "syncspace-"));

  try {
    let sourceFile;

    // C++
    if (normalizedLanguage === "cpp") {
      sourceFile = path.join(tempDir, "main.cpp");
      const executable = path.join(tempDir, os.platform() === "win32" ? "main.exe" : "main.out");
      fs.writeFileSync(sourceFile, code, "utf8");

      const compileResult = await runCommand("g++", [sourceFile, "-o", executable], tempDir);
      if (!compileResult.success) return compileResult;

      return await runCommand(executable, [], tempDir);
    }

    // C
    if (normalizedLanguage === "c") {
      sourceFile = path.join(tempDir, "main.c");
      const executable = path.join(tempDir, os.platform() === "win32" ? "main.exe" : "main.out");
      fs.writeFileSync(sourceFile, code, "utf8");

      const compileResult = await runCommand("gcc", [sourceFile, "-o", executable], tempDir);
      if (!compileResult.success) return compileResult;

      return await runCommand(executable, [], tempDir);
    }

    // Python
    if (normalizedLanguage === "python") {
      sourceFile = path.join(tempDir, "main.py");
      fs.writeFileSync(sourceFile, code, "utf8");

      let result = await runCommand("python", [sourceFile], tempDir);
      if (!result.success && result.output.includes("not found")) {
        result = await runCommand("py", [sourceFile], tempDir);
      }
      return result;
    }

    // Java
    if (normalizedLanguage === "java") {
      sourceFile = path.join(tempDir, "Main.java");
      fs.writeFileSync(sourceFile, code, "utf8");

      const compileResult = await runCommand("javac", [sourceFile], tempDir);
      if (!compileResult.success) return compileResult;

      return await runCommand("java", ["-cp", tempDir, "Main"], tempDir);
    }

    // Go
    if (normalizedLanguage === "go") {
      sourceFile = path.join(tempDir, "main.go");
      fs.writeFileSync(sourceFile, code, "utf8");
      return await runCommand("go", ["run", sourceFile], tempDir);
    }

    // Rust
    if (normalizedLanguage === "rust") {
      sourceFile = path.join(tempDir, "main.rs");
      const executable = path.join(tempDir, os.platform() === "win32" ? "main.exe" : "main.out");
      fs.writeFileSync(sourceFile, code, "utf8");

      const compileResult = await runCommand("rustc", [sourceFile, "-o", executable], tempDir);
      if (!compileResult.success) return compileResult;

      return await runCommand(executable, [], tempDir);
    }

    // JavaScript
    if (normalizedLanguage === "javascript") {
      sourceFile = path.join(tempDir, "main.js");
      fs.writeFileSync(sourceFile, code, "utf8");
      return await runCommand("node", [sourceFile], tempDir);
    }

    return {
      success: false,
      output: `Language ${language} not supported locally.`,
    };
  } catch (error) {
    return {
      success: false,
      output: error.message,
    };
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.error("Cleanup error:", cleanupError);
    }
  }
}

router.post("/execute", async (req, res) => {
  const { language, code, stdin } = req.body;

  if (!language || typeof code !== "string") {
    return res.status(400).json({
      success: false,
      output: "Language and code are required.",
    });
  }

  // 1. Try Piston Execution (Sandboxed, zero-dependency cloud execution)
  const pistonResult = await executeWithPiston(language, code, stdin || "");
  if (pistonResult) {
    return res.json(pistonResult);
  }

  // 2. Fallback to Local Host Machine Compilers
  const localResult = await executeLocally(language, code);
  return res.json(localResult);
});

module.exports = router;