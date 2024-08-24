#!/usr/bin/env python3

import argparse
import os
import subprocess
import sys
import shutil
import platform
import fnmatch

def run_command(command, cwd=None):
    print(f"Running: {command}")
    try:
        subprocess.run(command, cwd=cwd, check=True, text=True, shell=True)
        return True
    except subprocess.CalledProcessError as e:
        print(f"Command failed with return code {e.returncode}")
        print(f"Error output:\n{e.stderr}")
        return False

def get_default_platform():
    system = platform.system().lower()
    if system == "darwin":
        return "osx"
    elif system == "windows":
        return "windows"
    elif system == "linux":
        return "linux"
    else:
        return "unknown"

def get_default_arch():
    machine = platform.machine().lower()
    if machine in ["x86_64", "amd64"]:
        return "x86_64"
    elif machine in ["arm64", "aarch64"]:
        return "arm64"
    elif machine in ["i386", "i686"]:
        return "x86_32"
    elif machine.startswith("arm"):
        return "arm32"
    else:
        return "unknown"

def copy_module(source_dir, godot_dir):
    module_name = "javascript"
    target_dir = os.path.join(godot_dir, "modules", module_name)
    print(f"Copying module to {target_dir}")
    
    if os.path.exists(target_dir):
        shutil.rmtree(target_dir)
    
    ignore_patterns = ['godot', '.*', '__pycache__', 'scripts']
    
    def ignore_files(dir, files):
        return [f for f in files if any(fnmatch.fnmatch(f, pattern) for pattern in ignore_patterns)]
    
    shutil.copytree(source_dir, target_dir, ignore=ignore_files)

def setup_godot(git_ref, platform, arch):
    script_dir = os.path.dirname(os.path.abspath(__file__))
    module_root = os.path.dirname(script_dir)
    godot_dir = os.path.join(module_root, "godot")
    os.makedirs(godot_dir, exist_ok=True)
    print(f"Working directory: {godot_dir}")

    if not os.path.exists(os.path.join(godot_dir, ".git")):
        if not run_command("git init", cwd=godot_dir):
            return False

    print(f"Fetching Godot at ref: {git_ref}")
    if not run_command(f"git fetch --depth 1 https://github.com/godotengine/godot.git {git_ref}", cwd=godot_dir):
        return False

    print(f"Checking out ref: {git_ref}")
    if not run_command(f"git checkout FETCH_HEAD", cwd=godot_dir):
        return False

    # Copy the module
    copy_module(module_root, godot_dir)

    print(f"Building Godot for platform: {platform}, architecture: {arch}")
    scons_command = f"scons platform={platform} target=editor dev_build=yes debug_symbols=yes use_lto=no bits={64 if arch in ['x86_64', 'arm64'] else 32}"
    
    if platform == "osx" and arch == "arm64":
        scons_command += " arch=arm64"

    if not run_command(scons_command, cwd=godot_dir):
        print("SCons build failed. Please check the Godot documentation for your platform's build requirements.")
        return False

    print("Godot setup completed successfully!")
    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Set up Godot from a specific Git ref")
    parser.add_argument("git_ref", help="Git ref (branch or tag) to clone")
    parser.add_argument("--platform", choices=["default", "windows", "osx", "linux", "android", "ios", "web"], default="default", help="Target platform")
    parser.add_argument("--arch", choices=["default", "x86_32", "x86_64", "arm32", "arm64"], default="default", help="Target architecture")
    
    args = parser.parse_args()
    
    if args.platform == "default":
        args.platform = get_default_platform()
    if args.arch == "default":
        args.arch = get_default_arch()
    
    if args.platform == "unknown" or args.arch == "unknown":
        print("Error: Unable to determine default platform or architecture.")
        sys.exit(1)
    
    if not setup_godot(args.git_ref, args.platform, args.arch):
        print("Godot setup failed. Please check the error messages above.")
        sys.exit(1)