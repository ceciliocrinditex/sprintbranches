const readline = require("readline")
const config = require("./config.json")
const { Octokit } = require("@octokit/core")
const { clear } = require("node:console")

const REQUIRED_NODE_VERSION = 10

async function checkRequirements() {
  const nodeVersion = process.version.split("v")[1]
  const majorNodeVersion = Number(nodeVersion.split(".")[0])

  if (majorNodeVersion < REQUIRED_NODE_VERSION) {
    console.warn(`Using a node version lower than ${REQUIRED_NODE_VERSION} could cause problems\n`)
  }

  if (!config.repositories || !config.repositories.length > 0) {
    console.error("You need to add the repositories")
    process.exit(1)
  }

  if (!config.branches || !config.branches.length > 0) {
    console.error("You need to add the branches")
    process.exit(1)
  }

  if (!config.token) {
    console.error("You need to add a Github token")
    process.exit(1)
  }

  if (!config.branchFrom) {
    console.error("You need to add a branch")
    process.exit(1)
  }

  if (!config.owner) {
    console.error("You need to add a owner")
    process.exit(1)
  }
}

function checkAnswer(answer) {
  if (answer.toLowerCase().includes("y") || answer.toLowerCase().includes("yes")) return true
}

async function init() {
  clear()

  console.time("Execution time")

  await checkRequirements()

  // const tokenBuffer = Buffer.from(config.token, "base64");
  // const tokenDecoded = tokenBuffer.toString("utf-8");

  const octokit = new Octokit({
    auth: config.token,
  })

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  let deleteBranches = false
  const wantDeleteBranches = await new Promise((resolve) => {
    rl.question("\nDelete existing branches? (Y) or (N): ", resolve)
  })

  if (checkAnswer(wantDeleteBranches)) {
    const confirmDeleteBranches = await new Promise((resolve) => {
      rl.question("\nAre you sure? (Y) or (N): ", resolve)
    })

    deleteBranches = checkAnswer(confirmDeleteBranches)
  }

  rl.close()

  console.info("\nNumber of repositories:\x1b[1m", config.repositories.length, "\x1b[0m")

  console.info("Number of branches:\x1b[1m", config.branches.length, "\x1b[0m\n")

  for (const repository of config.repositories) {
    const branches = await octokit.request(`GET /repos/{owner}/{repo}/git/refs/heads`, {
      owner: config.owner,
      repo: repository,
    })

    let sha
    let remoteBranchExists = false
    for (const branch of config.branches) {
      for (const remoteBranch of branches.data) {
        if (remoteBranch.ref.includes(branch)) {
          if (deleteBranches) {
            await octokit.request("DELETE /repos/{owner}/{repo}/git/refs/{ref}", {
              owner: config.owner,
              repo: repository,
              ref: config.prevSuffixSprintNumber ? `heads/${branch}-${config.prevSuffixSprintNumber}` : `heads/${branch}`,
            })

            continue
          }

          console.warn(`"${branch}" already exists in ${repository}`)
          remoteBranchExists = true
          continue
        }

        if (remoteBranch.ref.includes(config.branchFrom)) sha = remoteBranch.object.sha
      }

      if (remoteBranchExists) continue

      await octokit.request("POST /repos/{owner}/{repo}/git/refs", {
        owner: config.owner,
        repo: repository,
        ref: config.suffixSprintNumber ? `refs/heads/${branch}-${config.suffixSprintNumber}` : `refs/heads/${branch}`,
        sha,
      })
    }
  }

  console.info("\n\x1b[32m\x1b[1mDone!\x1b[0m\n")
  console.timeEnd("Execution time")
}

init()
