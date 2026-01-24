import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const isDryRun = process.env.DRY_RUN === 'true';

const bumpVersion = (
  version: string,
  type: 'major' | 'minor' | 'patch',
): string => {
  const [major, minor, patch] = version.split('.').map(Number);

  switch (type) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      throw new Error(`Invalid bump type: ${type}`);
  }
};

const extractCommitType = (message: string): string | null => {
  // Handle squashed merge commits: "Merge pull request #123 from branch\n\nfeat: message"
  // or "feat(scope): message (#123)"
  const mergeMatch = message.match(
    /(?:Merge.*?\n\n?)?(?:^|\n)(feat|fix|chore|docs|test|style|refactor|perf|build|ci|revert|security|sync)(?:\([^)]+\))?(!)?: /m,
  );

  if (mergeMatch) {
    return mergeMatch[1]; // Returns the commit type (feat, fix, etc.)
  }

  return null;
};

const determineBumpType = (): 'major' | 'minor' | 'patch' => {
  try {
    const commitMessage = execSync('git log -1 --pretty=format:"%s%n%b"', {
      stdio: 'pipe',
    })
      .toString()
      .trim();

    // Check for breaking change indicator (! after type/scope)
    if (
      commitMessage.includes('!:') ||
      commitMessage.includes('BREAKING CHANGE')
    ) {
      return 'major';
    }

    // Extract commit type from message (handles merge commits)
    const commitType = extractCommitType(commitMessage);

    // Feature commits bump minor version
    if (commitType === 'feat') {
      return 'minor';
    }

    // Everything else (fix, chore, docs, etc.) bumps patch version
    return 'patch';
  } catch (error) {
    console.warn(
      'Could not determine bump type from commit message, defaulting to patch',
      error,
    );
    return 'patch';
  }
};

(async () => {
  if (isDryRun) {
    console.log('\n--- 🧪 DRY RUN MODE ENABLED 🧪 ---\n');
  }

  const bumpType = determineBumpType();
  console.log(`📦 Determined version bump type: ${bumpType}`);

  try {
    const packageJsonPath = resolve(process.cwd(), 'package.json');
    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    const oldVersion = pkg.version;

    if (!oldVersion) {
      console.warn(`⚠️  No version found in package.json. Skipping.`);
      process.exit(1);
    }

    const newVersion = bumpVersion(oldVersion, bumpType);

    pkg.version = newVersion;

    if (!isDryRun) {
      writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
      console.log(`✅ Bumped ${pkg.name} from ${oldVersion} to ${newVersion}`);

      // Commit and push changes
      console.log('📝 Committing version changes...');
      execSync('git add package.json');
      const commitMessage = `chore(release): bump version to ${newVersion} [skip ci]`;
      execSync(`git commit -m "${commitMessage}" --no-verify`);

      const branch =
        process.env.GITHUB_REF_NAME ??
        execSync('git branch --show-current').toString().trim();

      if (!branch) {
        throw new Error(
          'Unable to determine branch for pushing release commit.',
        );
      }

      console.log(`🚀 Pushing to branch: ${branch}`);
      execSync(`git push origin HEAD:refs/heads/${branch}`);
      console.log(`✨ Successfully pushed version ${newVersion}`);
    } else {
      console.log(
        `\n[DRY RUN] 🚀 Would bump ${pkg.name} from ${oldVersion} to ${newVersion}`,
      );
      console.log(
        `[DRY RUN] � Would commit: "chore(release): bump version to ${newVersion} [skip ci]"`,
      );
    }
  } catch (error) {
    console.error(`❌ Failed to version package:`, error);
    process.exit(1);
  }
})();
