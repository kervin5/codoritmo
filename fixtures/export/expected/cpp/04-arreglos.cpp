// Este código fue generado por Codoritmo a partir del pseudocódigo.
// Puede que no sea completamente correcto: revíselo antes de usarlo.

#include<iostream>
#include<string>
using namespace std;

// C++ no permite dimensionar arreglos estáticos con un tamaño variable:
// se usa un tamaño máximo ARREGLO_MAX.
#define ARREGLO_MAX 100
// No se pudo determinar el tipo de algunas variables: se declaran como
// SIN_TIPO. Reemplácelo por el tipo adecuado (int, double, string o bool).
#define SIN_TIPO string

int main() {
	SIN_TIPO a[10];
	SIN_TIPO b[20][30];
	SIN_TIPO c[40];
	SIN_TIPO d[50][5];
	SIN_TIPO e[ARREGLO_MAX];
	int n;
	cin >> n;
	cin >> a[0];
	a[9] = a[0];
	cout << b[9][9] << endl;
	return 0;
}
