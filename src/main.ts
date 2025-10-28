import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { createInterface } from "node:readline"

const TOOL_NAME = "f"
const VERSION = "0.1.5"
const TAGLINE = "Move faster"

interface CommandDefinition {
  name: string
  description: string
  usage?: string
  aliases?: readonly string[]
  run: (args: readonly string[]) => Promise<void> | void
}

const commands: CommandDefinition[] = [
  {
    name: "init",
    description: "Create Taskfile.yml with dev task running bun dev",
    usage: "init",
    async run(args) {
      if (args.length > 0) {
        throw new Error(`Unexpected arguments for init: ${args.join(" ")}`)
      }
      await handleInit()
    },
  },
]

function findCommand(input: string): CommandDefinition | undefined {
  const normalized = input.toLowerCase()
  return commands.find((command) => {
    if (command.name === normalized) {
      return true
    }
    if (!command.aliases) {
      return false
    }
    return command.aliases.some((alias) => alias === normalized)
  })
}

function printGeneralHelp() {
  console.log(`${TOOL_NAME} ${VERSION}`)
  console.log(`${TAGLINE}\n`)
  console.log("Usage:")
  console.log(`  ${TOOL_NAME} <command> [options]`)
  console.log(`  ${TOOL_NAME} --help`)
  console.log(`  ${TOOL_NAME} --version\n`)
  console.log("Commands:")
  const nameWidth = commands.reduce(
    (width, command) => Math.max(width, command.name.length),
    0,
  )
  for (const command of commands) {
    const padded = command.name.padEnd(nameWidth, " ")
    console.log(`  ${padded}  ${command.description}`)
  }
  console.log(`\nRun \`${TOOL_NAME} <command> --help\` for command details.`)
}

function printCommandHelp(command: CommandDefinition) {
  console.log(`${TOOL_NAME} ${VERSION}`)
  console.log(`${command.name}\n`)
  console.log(`${command.description}\n`)
  console.log("Usage:")
  console.log(`  ${TOOL_NAME} ${command.usage ?? command.name}`)
}

function buildSearchText(command: CommandDefinition) {
  const aliasText = command.aliases?.join(" ") ?? ""
  return `${command.name} ${aliasText} ${command.description}`.toLowerCase()
}

function fuzzyScore(query: string, candidate: string): number {
  const normalizedQuery = query.toLowerCase().replace(/\s+/g, "")
  if (!normalizedQuery) {
    return -1
  }

  let score = 0
  let candidateIndex = 0

  for (const char of normalizedQuery) {
    const target = char.toLowerCase()
    const matchIndex = candidate.indexOf(target, candidateIndex)
    if (matchIndex === -1) {
      return -1
    }
    if (matchIndex === candidateIndex) {
      score += 2
    } else {
      score += 1
    }
    candidateIndex = matchIndex + 1
  }

  return score
}

function rankCommands(
  query: string,
  definitions: readonly CommandDefinition[],
) {
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 0)

  if (tokens.length === 0) {
    return []
  }

  return definitions
    .map((command) => {
      const searchText = buildSearchText(command)
      let score = 0

      for (const token of tokens) {
        const tokenScore = fuzzyScore(token, searchText)
        if (tokenScore < 0) {
          return { command, score: -1 }
        }
        score += tokenScore
      }

      return { command, score }
    })
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score
      }
      return a.command.name.localeCompare(b.command.name)
    })
}

function suggestClosestCommand(input: string) {
  const [best] = rankCommands(input, commands)
  return best ? best.command : undefined
}

async function promptForCommand(
  definitions: readonly CommandDefinition[],
): Promise<CommandDefinition | undefined> {
  if (definitions.length === 0) {
    return undefined
  }

  console.log("Available commands:")
  for (const command of definitions) {
    console.log(`  ${command.name}  ${command.description}`)
  }
  console.log("\nType to filter commands. Press Enter to cancel.\n")

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const question = (prompt: string) =>
    new Promise<string>((resolve) => rl.question(prompt, resolve))

  try {
    while (true) {
      const term = (await question("Search command (Enter to cancel): ")).trim()

      if (!term) {
        return undefined
      }

      const ranked = rankCommands(term, definitions)

      if (ranked.length === 0) {
        console.log("No matching commands. Try again.\n")
        continue
      }

      if (ranked.length === 1) {
        return ranked[0]?.command
      }

      const suggestions = ranked.slice(0, Math.min(5, ranked.length))

      console.log("")
      console.log("Matches:")
      suggestions.forEach((entry, index) => {
        console.log(
          `  ${index + 1}. ${entry.command.name}  ${entry.command.description}`,
        )
      })
      console.log("")

      const selectionRaw = (
        await question(
          "Select command number (Enter to refine search): ",
        )
      ).trim()

      if (!selectionRaw) {
        continue
      }

      const selection = Number.parseInt(selectionRaw, 10)
      if (
        Number.isInteger(selection) &&
        selection >= 1 &&
        selection <= suggestions.length
      ) {
        return suggestions[selection - 1]?.command
      }

      console.log("Invalid selection. Try again.\n")
    }
  } finally {
    rl.close()
  }
}

async function executeCommand(
  command: CommandDefinition,
  args: readonly string[],
) {
  await command.run(args)
}

async function main() {
  try {
    const args = process.argv.slice(2)

    if (args.length === 0) {
      if (!process.stdin.isTTY || !process.stdout.isTTY) {
        printGeneralHelp()
        return
      }

      const selection = await promptForCommand(commands)
      if (!selection) {
        return
      }

      await executeCommand(selection, [])
      return
    }

    if (args.length === 1 && (args[0] === "--version" || args[0] === "-v")) {
      console.log(VERSION)
      return
    }

    if (args.length === 1 && (args[0] === "--help" || args[0] === "-h")) {
      printGeneralHelp()
      return
    }

    if (args[0] === "help") {
      const target = args[1]
      if (!target) {
        printGeneralHelp()
        return
      }

      const command = findCommand(target)
      if (!command) {
        console.error(`Unknown command: ${target}`)
        const suggestion = suggestClosestCommand(target)
        if (suggestion) {
          console.error(`Did you mean "${suggestion.name}"?`)
        }
        process.exitCode = 1
        return
      }

      printCommandHelp(command)
      return
    }

    const [commandName, ...commandArgs] = args
    const command = findCommand(commandName)

    if (!command) {
      console.error(`Unknown command: ${commandName}`)
      const suggestion = suggestClosestCommand(commandName)
      if (suggestion) {
        console.error(`Did you mean "${suggestion.name}"?`)
      }
      process.exitCode = 1
      return
    }

    if (commandArgs.some((value) => value === "--help" || value === "-h")) {
      printCommandHelp(command)
      return
    }

    await executeCommand(command, commandArgs)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

async function handleInit() {
  const cwd = process.cwd()
  const packageJsonPath = resolve(cwd, "package.json")

  if (!existsSync(packageJsonPath)) {
    throw new Error("package.json not found in the current directory.")
  }

  let packageJsonContent: string
  try {
    packageJsonContent = readFileSync(packageJsonPath, "utf8")
  } catch (error) {
    throw new Error(
      `Unable to read package.json: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(packageJsonContent)
  } catch (error) {
    throw new Error(
      `package.json is not valid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }

  let devScript: string | undefined
  if (parsed && typeof parsed === "object" && "scripts" in parsed) {
    const scripts = (parsed as { scripts?: Record<string, unknown> }).scripts
    const candidate = scripts && typeof scripts === "object" ? scripts.dev : undefined
    if (typeof candidate === "string" && candidate.trim()) {
      devScript = candidate.trim()
    }
  }

  if (!devScript) {
    throw new Error("No dev script found in package.json.")
  }

  const taskfilePath = resolve(cwd, "Taskfile.yml")

  if (existsSync(taskfilePath)) {
    throw new Error("Taskfile.yml already exists. Aborting to avoid overwriting.")
  }

  const content = [
    'version: "3"',
    "",
    "tasks:",
    "  dev:",
    "    cmds:",
    "      - bun dev",
    "",
  ].join("\n")

  try {
    writeFileSync(taskfilePath, content)
  } catch (error) {
    throw new Error(
      `Failed to write Taskfile.yml: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }

  console.log("Created Taskfile.yml with dev task running bun dev.")
}

void main()
