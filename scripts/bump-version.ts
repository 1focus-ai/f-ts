import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

type Increment = "major" | "minor" | "patch"

function parseIncrement(value: string | undefined): Increment {
  if (!value) return "minor"
  if (value === "major" || value === "minor" || value === "patch") {
    return value
  }

  throw new Error(`Unsupported increment "${value}". Use major, minor, or patch.`)
}

function bump(version: string, increment: Increment): string {
  const parts = version.split(".").map((part) => Number.parseInt(part, 10))
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    throw new Error(`Invalid semantic version: ${version}`)
  }

  const [major, minor, patch] = parts

  if (increment === "major") {
    return `${major + 1}.0.0`
  }
  if (increment === "minor") {
    return `${major}.${minor + 1}.0`
  }
  return `${major}.${minor}.${patch + 1}`
}

function main() {
  const increment = parseIncrement(process.argv[2])
  const cwd = process.cwd()

  const packageJsonPath = resolve(cwd, "package.json")
  const packageJsonRaw = readFileSync(packageJsonPath, "utf8")
  const packageJson = JSON.parse(packageJsonRaw) as { version?: string }

  const currentVersion = packageJson.version
  if (typeof currentVersion !== "string") {
    throw new Error("package.json does not contain a version string.")
  }

  const nextVersion = bump(currentVersion, increment)
  packageJson.version = nextVersion
  writeFileSync(
    packageJsonPath,
    `${JSON.stringify(packageJson, null, 2)}\n`,
  )

  const mainPath = resolve(cwd, "src", "main.ts")
  const mainSource = readFileSync(mainPath, "utf8")
  const updatedMainSource = mainSource.replace(
    /const VERSION = "[^"]+"/,
    `const VERSION = "${nextVersion}"`,
  )

  if (mainSource === updatedMainSource) {
    throw new Error("Unable to update VERSION constant in src/main.ts.")
  }

  writeFileSync(mainPath, updatedMainSource)

  console.log(`Bumped version: ${currentVersion} -> ${nextVersion}`)
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
