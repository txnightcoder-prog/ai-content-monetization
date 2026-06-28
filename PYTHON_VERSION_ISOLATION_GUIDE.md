# Python Version Isolation Guide

## How to Ensure Python 3.14 Doesn't Interfere

When you have multiple Python versions installed, you need to ensure your project uses the correct one. Here's how:

## 1. Virtual Environments (Recommended Solution)

Virtual environments create **isolated** Python installations for each project. This is the best practice.

### Why Virtual Environments Work
- Each venv has its own Python interpreter
- Each venv has its own packages (completely separate)
- Python 3.14 packages won't mix with Python 3.13 packages
- No cross-contamination between projects

### How SETUP_BACKEND_PY313.bat Ensures Isolation

The script does this:
```batch
py -3.13 -m venv venv
```

This creates a **brand new** Python 3.13 environment in `backend/venv/` that:
- Uses Python 3.13 interpreter (not 3.14)
- Has NO packages installed initially
- Is completely separate from global Python installations

When you activate it:
```batch
call venv\Scripts\activate.bat
```

Your terminal now uses:
- `python` → Points to Python 3.13 in venv
- `pip` → Installs packages ONLY in this venv
- All packages are isolated in `backend/venv/Lib/site-packages/`

## 2. Verify Your Virtual Environment

After running SETUP_BACKEND_PY313.bat, verify isolation:

```powershell
cd backend
.\venv\Scripts\activate
python --version
```

Should show: `Python 3.13.x` (NOT 3.14)

```powershell
where python
```

Should show: `C:\Users\JohnKirshy\Desktop\ai-content-monetization\backend\venv\Scripts\python.exe`

## 3. Check Package Locations

```powershell
pip show pydantic
```

Look for `Location:` - it should be in your venv:
```
Location: C:\Users\JohnKirshy\Desktop\ai-content-monetization\backend\venv\Lib\site-packages
```

NOT in:
- `C:\Users\JohnKirshy\AppData\Roaming\Python\Python314\site-packages`
- `C:\Python314\Lib\site-packages`

## 4. Always Activate Before Working

**CRITICAL:** Always activate the venv before running commands:

```batch
cd backend
venv\Scripts\activate
python -m uvicorn app.main:app --reload
```

If you forget to activate, you'll use the global Python (3.14), which will fail.

## 5. Clean Up Old Installations (Optional)

If you want to remove Python 3.14 packages that were installed globally:

```powershell
# List globally installed packages
pip list --user

# Uninstall specific packages
pip uninstall pydantic pydantic-core fastapi uvicorn
```

But this is **NOT necessary** if you use virtual environments correctly.

## 6. VSCode Integration

To ensure VSCode uses the correct Python:

1. Open Command Palette (Ctrl+Shift+P)
2. Type: "Python: Select Interpreter"
3. Choose: `.\backend\venv\Scripts\python.exe`

This ensures:
- VSCode terminal auto-activates the venv
- IntelliSense uses correct packages
- Debugging uses correct Python version

## 7. Verification Checklist

Run these commands with venv activated:

```powershell
# Should show Python 3.13.x
python --version

# Should show venv path
where python

# Should show venv location
pip show fastapi

# Should list all installed packages in venv
pip list
```

## Summary

✅ **Virtual environments completely isolate Python versions**
✅ **Python 3.14 cannot interfere with your venv**
✅ **Each project can use different Python versions**
✅ **Always activate venv before working**

The key is: **Always use the virtual environment** and you'll never have version conflicts.