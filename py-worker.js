importScripts('https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js');

let pyodide;

async function init() {
  postMessage({ type: 'STATUS', status: 'loading' });
  try {
    pyodide = await loadPyodide();
    await pyodide.loadPackage('micropip');
    
    // Patch builtins.input to make a synchronous XHR to the Service Worker
    pyodide.runPython(`
import sys, io, builtins
import js

def custom_input(prompt_text=""):
    xhr = js.XMLHttpRequest.new()
    # Synchronous request blocks this Worker thread until Service Worker replies!
    xhr.open("GET", "/__luna_python_input?prompt=" + js.encodeURIComponent(prompt_text), False)
    xhr.send(None)
    
    if xhr.status == 200:
        return xhr.responseText
    return ""

builtins.input = custom_input
    `);
    
    postMessage({ type: 'STATUS', status: 'ready' });
  } catch (err) {
    postMessage({ type: 'STATUS', status: 'error', error: err.message });
  }
}

init();

self.onmessage = async (e) => {
  if (e.data.type === 'RUN_CODE') {
    if (!pyodide) {
      postMessage({ type: 'RUN_DONE', output: null, error: 'Pyodide not ready yet.' });
      return;
    }
    try {
      // Capture stdout
      pyodide.runPython('import sys, io\n_cap = io.StringIO()\nsys.stdout = _cap');
      await pyodide.runPythonAsync(e.data.code);
      const output = pyodide.runPython('sys.stdout = sys.__stdout__\n_cap.getvalue()');
      postMessage({ type: 'RUN_DONE', output: output, error: null });
    } catch (err) {
      // Restore stdout in case of error
      try { pyodide.runPython('import sys; sys.stdout = sys.__stdout__'); } catch(_) {}
      postMessage({ type: 'RUN_DONE', output: null, error: err.message });
    }
  }
};
