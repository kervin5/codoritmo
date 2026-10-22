/**
 * @jest-environment node
 */
import { fitComplexity, measureComplexity, type ComplexityClass } from "../engine";

const programs: Record<string, { source: string; time: ComplexityClass; space: ComplexityClass }> = {
  constant: {
    time: "O(1)",
    space: "O(1)",
    source: `Algoritmo Constante
	Leer n
	Escribir n * 2 + 1
FinAlgoritmo`,
  },
  linear: {
    time: "O(n)",
    space: "O(n)",
    source: `Algoritmo Lineal
	Leer n
	Dimension v[n]
	suma <- 0
	Para i <- 1 Hasta n Hacer
		v[i] <- i
		suma <- suma + v[i]
	FinPara
	Escribir suma
FinAlgoritmo`,
  },
  logarithmic: {
    time: "O(log n)",
    space: "O(1)",
    source: `Algoritmo Logaritmico
	Leer n
	pasos <- 0
	Mientras n > 1 Hacer
		n <- Trunc(n / 2)
		pasos <- pasos + 1
	FinMientras
	Escribir pasos
FinAlgoritmo`,
  },
  quadratic: {
    time: "O(n²)",
    space: "O(n)",
    source: `Algoritmo Burbuja
	Leer n
	Dimension v[n]
	Para i <- 1 Hasta n Hacer
		v[i] <- Aleatorio(1, 999)
	FinPara
	Para i <- 1 Hasta n - 1 Hacer
		Para j <- 1 Hasta n - i Hacer
			Si v[j] > v[j + 1] Entonces
				aux <- v[j]
				v[j] <- v[j + 1]
				v[j + 1] <- aux
			FinSi
		FinPara
	FinPara
FinAlgoritmo`,
  },
  nLogN: {
    time: "O(n log n)",
    space: "O(n)",
    source: `SubProceso Mezclar(v, tmp, izq, medio, der)
	i <- izq
	j <- medio + 1
	k <- izq
	Mientras i <= medio Y j <= der Hacer
		Si v[i] <= v[j] Entonces
			tmp[k] <- v[i]
			i <- i + 1
		SiNo
			tmp[k] <- v[j]
			j <- j + 1
		FinSi
		k <- k + 1
	FinMientras
	Mientras i <= medio Hacer
		tmp[k] <- v[i]
		i <- i + 1
		k <- k + 1
	FinMientras
	Mientras j <= der Hacer
		tmp[k] <- v[j]
		j <- j + 1
		k <- k + 1
	FinMientras
	Para k <- izq Hasta der Hacer
		v[k] <- tmp[k]
	FinPara
FinSubProceso

SubProceso OrdenarMezcla(v, tmp, izq, der)
	Si izq < der Entonces
		medio <- Trunc((izq + der) / 2)
		OrdenarMezcla(v, tmp, izq, medio)
		OrdenarMezcla(v, tmp, medio + 1, der)
		Mezclar(v, tmp, izq, medio, der)
	FinSi
FinSubProceso

Algoritmo MergeSort
	Leer n
	Dimension v[n], tmp[n]
	Para i <- 1 Hasta n Hacer
		v[i] <- Aleatorio(1, 999)
	FinPara
	OrdenarMezcla(v, tmp, 1, n)
FinAlgoritmo`,
  },
  exponential: {
    time: "O(2ⁿ)",
    space: "O(n)",
    source: `Funcion r <- Fib(k)
	Si k < 2 Entonces
		r <- k
	SiNo
		r <- Fib(k - 1) + Fib(k - 2)
	FinSi
FinFuncion

Algoritmo Exponencial
	Leer n
	Escribir Fib(n)
FinAlgoritmo`,
  },
};

describe("measureComplexity", () => {
  it.each(Object.entries(programs))("recognises %s programs", async (_name, { source, time, space }) => {
    const sizes = time === "O(2ⁿ)" ? [4, 6, 8, 10, 12, 14, 16] : undefined;
    const report = await measureComplexity({ source, sizes });
    expect([report.issue, report.errorMessage]).toEqual([undefined, undefined]);
    expect(report.time.best).toBe(time);
    expect(report.space.best).toBe(space);
  });

  it("reports programs that never read n", async () => {
    const report = await measureComplexity({ source: `Algoritmo X\n\tEscribir 1\nFinAlgoritmo` });
    expect(report.issue).toBe("no-input");
  });

  it("reports runtime errors with their message", async () => {
    const report = await measureComplexity({ source: `Algoritmo X\n\tLeer n\n\tEscribir 1 / 0\nFinAlgoritmo` });
    expect(report.issue).toBe("error");
    expect(report.errorMessage).toBeTruthy();
  });

  it("counts comparisons and array accesses", async () => {
    const report = await measureComplexity({ source: programs.quadratic.source, sizes: [10] , });
    const m = report.samples[0].metrics;
    expect(m.comparisons).toBeGreaterThanOrEqual(45); // n(n-1)/2 element comparisons
    expect(m.arrayReads).toBeGreaterThan(m.comparisons);
    expect(m.peakArrayCells).toBe(10);
  });
});

describe("fitComplexity", () => {
  it("needs at least three points", () => {
    expect(fitComplexity([{ n: 1, y: 1 }, { n: 2, y: 4 }]).best).toBeNull();
  });

  it("fits clean synthetic curves", () => {
    const ns = [8, 16, 32, 64, 128];
    expect(fitComplexity(ns.map((n) => ({ n, y: 3 * n + 5 }))).best).toBe("O(n)");
    expect(fitComplexity(ns.map((n) => ({ n, y: n * n / 2 }))).best).toBe("O(n²)");
    expect(fitComplexity(ns.map((n) => ({ n, y: 4 * n * Math.log2(n) }))).best).toBe("O(n log n)");
  });
});
