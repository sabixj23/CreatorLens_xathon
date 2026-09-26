// simple-statistics only provides single-predictor linear regression — it has no
// multivariate regression. The growth model needs two predictors (cadence, format mix),
// so this is a small, self-contained ordinary-least-squares solver via the normal
// equations, solved by Gaussian elimination with partial pivoting.

function solveLinearSystem(a: number[][], b: number[]): number[] {
  const n = b.length;
  const augmented = a.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(augmented[row][col]) > Math.abs(augmented[pivotRow][col])) pivotRow = row;
    }
    [augmented[col], augmented[pivotRow]] = [augmented[pivotRow], augmented[col]];

    if (Math.abs(augmented[col][col]) < 1e-10) continue; // near-singular column — leaves coefficient at 0 below

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = augmented[row][col] / augmented[col][col];
      for (let c = col; c <= n; c++) augmented[row][c] -= factor * augmented[col][c];
    }
  }

  return augmented.map((row, i) => (Math.abs(row[i]) < 1e-10 ? 0 : row[n] / row[i]));
}

// features: each row already includes the intercept term as its first entry ([1, x1, x2, ...]).
export function fitOls(features: number[][], targets: number[]): number[] {
  const p = features[0]?.length ?? 0;
  const xtx: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
  const xty: number[] = new Array(p).fill(0);

  for (let row = 0; row < features.length; row++) {
    for (let i = 0; i < p; i++) {
      xty[i] += features[row][i] * targets[row];
      for (let j = 0; j < p; j++) {
        xtx[i][j] += features[row][i] * features[row][j];
      }
    }
  }

  return solveLinearSystem(xtx, xty);
}
