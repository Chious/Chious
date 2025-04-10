const fs = require('fs');

async function get_bar(percent) {
  const total = 14;
  const filled = Math.floor((percent / 100) * total);
  const empty = total - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

function calculateLevel(exp) {
  // Each level requires base_exp * (level) EXP
  // For example: Level 1: 100, Level 2: 200, Level 3: 300, etc.
  const base_exp = 400;
  let remainingExp = exp;
  let level = 1;
  
  while (remainingExp >= base_exp * level) {
    remainingExp -= base_exp * level;
    level++;
  }
  
  return {
    currentLevel: level,
    nextLevel: level + 1,
    expToNext: base_exp * level - remainingExp
  };
}

async function updateExp() {
  const readmePath = './README.md';
  let content = fs.readFileSync(readmePath, 'utf8');
  
  // Find the current EXP
  const expRegex = /`(\d+)\s*\/\s*2200 EXP`/;
  const match = content.match(expRegex);
  
  if (match) {
    const currentExp = parseInt(match[1]);
    const newExp = currentExp + 1;
    const maxExp = 2200;
    const percentage = ((newExp / maxExp) * 100).toFixed(1);
    const progressBar = await get_bar(percentage);
    
    // Calculate level
    const levelInfo = calculateLevel(newExp);
    
    // Update the level line
    const newLevelLine = `<li style="text-align: left" id="level"><strong>Level</strong> ${levelInfo.currentLevel} → ${levelInfo.nextLevel} (${levelInfo.expToNext} EXP to next)</li>`;
    content = content.replace(/<li[^>]*id="level".*?<\/li>/i, newLevelLine);
    
    // Update the EXP line with progress bar
    const newExpLine = `<li style="text-align: left; display: flex; align-items: center; gap: 10px;" id="exp"><strong>Total Experience</strong> \`${newExp} / ${maxExp} EXP\` | ${progressBar} (${percentage}%)</li>`;
    content = content.replace(/<li[^>]*id="exp".*?<\/li>/i, newExpLine);
    
    fs.writeFileSync(readmePath, content, 'utf8');
    console.log(`EXP updated: ${currentExp} -> ${newExp} (${percentage}%)`);
    console.log(`Level ${levelInfo.currentLevel} → ${levelInfo.nextLevel}, need ${levelInfo.expToNext} EXP for next level`);
  }
}

async function fetch_stats(username) {
  try {
    // Fetch user's repos
    const response = await fetch(
      `https://api.github.com/users/${username}/repos`
    );
    const repos = await response.json();

    // Fetch languages for each repo
    const languageStats = {};

    for (const repo of repos) {
      if (repo.language) {
        if (!languageStats[repo.language]) {
          languageStats[repo.language] = {
            count: 1,
            bytes: repo.size,
          };
        } else {
          languageStats[repo.language].count++;
          languageStats[repo.language].bytes += repo.size;
        }
      }
    }

    // Calculate percentages and levels
    const totalBytes = Object.values(languageStats).reduce(
      (sum, stat) => sum + stat.bytes,
      0
    );

    for (const lang in languageStats) {
      const percent = (languageStats[lang].bytes / totalBytes) * 100;
      const level = Math.floor(Math.log2(languageStats[lang].count + 1));
      languageStats[lang].percent = percent;
      languageStats[lang].level = level;
    }

    return languageStats;
  } catch (error) {
    console.error('Error fetching stats:', error);
    return {};
  }
}

async function generate_table(stats) {
  let table = '| Skill      | Level | EXP Bar        | Usage    |\n';
  table += '| ---------- | ----- | -------------- | -------- |\n';

  const sortedLangs = Object.entries(stats)
    .sort(([, a], [, b]) => b.percent - a.percent)
    .slice(0, 10);

  for (const [lang, data] of sortedLangs) {
    const bar = await get_bar(data.percent);
    const paddedLang = lang.padEnd(10);
    table += `| ${paddedLang} | Lv. ${
      data.level
    } | ${bar} | ${data.percent.toFixed(2)}% |\n`;
  }

  return table;
}

async function updateReadme(table) {
  const readmePath = './README.md';
  let content = fs.readFileSync(readmePath, 'utf8');
  const updateTime = new Date().toLocaleString();

  // Find the skills section using the section tag
  const sectionStartRegex = /<section[^>]*id="skills-section"[^>]*>/i;
  const sectionEndRegex = /<\/section>/;

  const startMatch = content.match(sectionStartRegex);
  if (!startMatch) {
    throw new Error('Could not find skills section in README.md');
  }

  const startIndex = startMatch.index;
  const afterStartIndex = startIndex + startMatch[0].length;

  // Find the matching closing section tag
  const remainingContent = content.slice(afterStartIndex);
  const endMatch = remainingContent.match(sectionEndRegex);
  if (!endMatch) {
    throw new Error('Could not find end of skills section in README.md');
  }

  const endIndex = afterStartIndex + endMatch.index + endMatch[0].length;

  // Create the new section content
  const newSectionContent =
    `<section id="skills-section">\n` +
    `<h2 style="color:#D9934C"> 📊 Top Skills</h2>\n\n` +
    `${table}\n` +
    `_Generated by GitHub API_\n\n` +
    `Last updated: ${updateTime}\n\n` +
    `</section>`;

  // Replace the entire section
  const newContent =
    content.slice(0, startIndex) + newSectionContent + content.slice(endIndex);

  fs.writeFileSync(readmePath, newContent, 'utf8');
}

async function main() {
  try {
    const user = 'chious';
    await updateExp(); // Update EXP first
    const stats = await fetch_stats(user);
    const table = await generate_table(stats);
    await updateReadme(table);
    console.log('README.md has been updated successfully!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
