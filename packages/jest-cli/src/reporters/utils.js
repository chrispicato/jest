/**
 * Copyright (c) 2014-present, Facebook, Inc. All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 */

'use strict';

import type {Config, Path} from 'types/Config';
import type {AggregatedResult} from 'types/TestResult';

const chalk = require('chalk');
const path = require('path');

type SummaryOptions = {|
  estimatedTime?: number,
  roundTime?: boolean,
  width?: number,
|};

const PROGRESS_BAR_WIDTH = 40;

const trimAndFormatPath = (
  pad: number,
  config: Config,
  testPath: Path,
  columns: number,
): string => {
  const maxLength = columns - pad;
  const relative = relativePath(config, testPath);
  const {basename} = relative;
  let {dirname} = relative;

  // length is ok
  if ((dirname + path.sep + basename).length <= maxLength) {
    return chalk.dim(dirname + path.sep) + chalk.bold(basename);
  }

  // we can fit trimmed dirname and full basename
  const basenameLength = basename.length;
  if (basenameLength + 4 < maxLength) {
    const dirnameLength = maxLength - 4 - basenameLength;
    dirname = '...' +
      dirname.slice(dirname.length - dirnameLength, dirname.length);
    return chalk.dim(dirname + path.sep) + chalk.bold(basename);
  }

  if (basenameLength + 4 === maxLength) {
    return chalk.dim('...' + path.sep) + chalk.bold(basename);
  }

  // can't fit dirname, but can fit trimmed basename
  return chalk.bold(
    '...' +
    basename.slice(basename.length - maxLength - 4, basename.length),
  );
};

const formatTestPath = (config: Config, testPath: Path) => {
  const {dirname, basename} = relativePath(config, testPath);
  return chalk.dim(dirname + path.sep) + chalk.bold(basename);
};

const relativePath = (config: Config, testPath: Path) => {
  testPath = path.relative(config.rootDir, testPath);
  const dirname = path.dirname(testPath);
  const basename = path.basename(testPath);
  return {dirname, basename};
};

const pluralize = (word: string, count: number) =>
  `${count} ${word}${count === 1 ? '' : 's'}`;

const getSummary = (
  aggregatedResults: AggregatedResult,
  options?: SummaryOptions,
) => {
  let runTime = (Date.now() - aggregatedResults.startTime) / 1000;
  if (options && options.roundTime) {
    runTime = Math.floor(runTime);
  }

  const estimatedTime = (options && options.estimatedTime) || 0;
  const snapshotResults = aggregatedResults.snapshot;
  const snapshotsAdded = snapshotResults.added;
  const snapshotsFailed = snapshotResults.unmatched;
  const snapshotsPassed = snapshotResults.matched;
  const snapshotsTotal = snapshotResults.total;
  const snapshotsUpdated = snapshotResults.updated;
  const suitesFailed = aggregatedResults.numFailedTestSuites;
  const suitesPassed = aggregatedResults.numPassedTestSuites;
  const suitesPending = aggregatedResults.numPendingTestSuites;
  const suitesRun = suitesFailed + suitesPassed;
  const suitesTotal = aggregatedResults.numTotalTestSuites;
  const testsFailed = aggregatedResults.numFailedTests;
  const testsPassed = aggregatedResults.numPassedTests;
  const testsPending = aggregatedResults.numPendingTests;
  const testsTotal = aggregatedResults.numTotalTests;
  const width = (options && options.width) || 0;

  const suites =
    chalk.bold('Test Suites: ') +
    (suitesFailed ? chalk.bold.red(`${suitesFailed} failed`) + ', ' : '') +
    (suitesPending
      ? chalk.bold.yellow(`${suitesPending} skipped`) + ', '
      : ''
    ) +
    (suitesPassed
      ? chalk.bold.green(`${suitesPassed} passed`) + ', '
      : ''
    ) +
    (suitesRun !== suitesTotal
      ? suitesRun + ' of ' + suitesTotal
      : suitesTotal
    ) + ` total`;

  const tests =
    chalk.bold('Tests:       ') +
    (testsFailed ? chalk.bold.red(`${testsFailed} failed`) + ', ' : '') +
    (testsPending
      ? chalk.bold.yellow(`${testsPending} skipped`) + ', '
      : ''
    ) +
    (testsPassed
      ? chalk.bold.green(`${testsPassed} passed`) + ', '
      : ''
    ) +
    `${testsTotal} total`;

  const snapshots =
    chalk.bold('Snapshots:   ') +
    (snapshotsFailed
      ? chalk.bold.red(`${snapshotsFailed} failed`) + ', '
      : ''
    ) +
    (snapshotsUpdated
      ? chalk.bold.green(`${snapshotsUpdated} updated`) + ', '
      : ''
    ) +
    (snapshotsAdded
      ? chalk.bold.green(`${snapshotsAdded} added`) + ', '
      : ''
    ) +
    (snapshotsPassed
      ? chalk.bold.green(`${snapshotsPassed} passed`) + ', '
      : ''
    ) +
    `${snapshotsTotal} total`;

  const time = renderTime(runTime, estimatedTime, width);
  return [suites, tests, snapshots, time].join('\n');
};

const renderTime = (
  runTime,
  estimatedTime,
  width,
) => {
  // If we are more than one second over the estimated time, highlight it.
  const renderedTime = (estimatedTime && runTime >= estimatedTime + 1)
    ? chalk.bold.red(runTime + 's')
    : runTime + 's';
  let time = chalk.bold(`Time:`) + `        ${renderedTime}`;
  if (runTime < estimatedTime) {
    time += `, estimated ${estimatedTime}s`;
  }

  // Only show a progress bar if the test run is actually going to take
  // some time.
  if (
    estimatedTime > 2 &&
    runTime < estimatedTime &&
    width
  ) {
    const availableWidth = Math.min(PROGRESS_BAR_WIDTH, width);
    const length = Math.min(
      Math.floor(runTime / estimatedTime * availableWidth),
      availableWidth,
    );
    if (availableWidth >= 2) {
      time +=
        '\n' +
        chalk.green.inverse(' ').repeat(length) +
        chalk.white.inverse(' ').repeat(availableWidth - length);
    }
  }
  return time;
};

// wrap a string that contains ANSI escape sequences. ANSI escape sequences
// do not add to the string length.
const wrapAnsiString = (string: string, width: number) => {
  const ANSI_REGEXP = /[\u001b\u009b]\[\d{1,2}m/g;
  const tokens = [];
  let lastIndex = 0;
  let match;

  while (match = ANSI_REGEXP.exec(string)) {
    const ansi = match[0];
    const index = match['index'];
    if (index != lastIndex) {
      tokens.push(['string', string.slice(lastIndex, index)]);
    }
    tokens.push(['ansi', ansi]);
    lastIndex = index + ansi.length;
  }

  if (lastIndex != string.length - 1) {
    tokens.push(['string', string.slice(lastIndex, string.length)]);
  }

  let lastLineLength = 0;

  return tokens.reduce(
    (lines, [kind, token]) => {
      if (kind === 'string') {
        if (lastLineLength + token.length > width) {

          while (token.length) {
            const chunk = token.slice(0, width - lastLineLength);
            const remaining = token.slice(width - lastLineLength, token.length);
            lines[lines.length - 1] += chunk;
            lastLineLength += chunk.length;
            token = remaining;
            if (token.length) {
              lines.push('');
              lastLineLength = 0;
            }
          }
        } else {
          lines[lines.length - 1] += token;
          lastLineLength += token.length;
        }
      } else {
        lines[lines.length - 1] += token;
      }

      return lines;
    },
    [''],
  ).join('\n');
};

module.exports = {
  formatTestPath,
  getSummary,
  pluralize,
  relativePath,
  trimAndFormatPath,
  wrapAnsiString,
};
