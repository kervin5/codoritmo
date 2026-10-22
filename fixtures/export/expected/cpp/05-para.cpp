// Este código fue generado por Codoritmo a partir del pseudocódigo.
// Puede que no sea completamente correcto: revíselo antes de usarlo.

#include<iostream>
#include<cmath>
#include<cstdio>
#include<cstring>
#include<string>
using namespace std;

// Funciones auxiliares, definidas al final
string convertiratexto(double valor);

int main() {
	int a[10] = {};
	double b[3][6] = {};
	double c = 0;
	int i = 0;
	int j = 0;
	for (i=1; i<=10; ++i) {
		a[i-1] = i*10;
	}
	for (auto aux_ptr_0=&(a[0]); aux_ptr_0<=&(a[9]); ++aux_ptr_0) {
		auto &elemento = *aux_ptr_0;
		cout << elemento << endl;
	}
	c = 0;
	for (auto aux_ptr_0=&(b[0][0]); aux_ptr_0<=&(b[2][5]); ++aux_ptr_0) {
		auto &x = *aux_ptr_0;
		(void)x;
		c = c+1;
		x = c;
	}
	for (i=3; i>=1; --i) {
		for (j=1; j<=5; j+=2) {
			cout << convertiratexto(b[i-1][j-1]) << endl;
		}
	}
	return 0;
}

// Escribe un número como PSeInt: redondeado a 10 decimales, sin ceros
// finales y sin notación exponencial.
string convertiratexto(double valor) {
	char buffer[400];
	if (valor==floor(valor)) {
		snprintf(buffer, sizeof buffer, "%.0f", valor);
	} else {
		snprintf(buffer, sizeof buffer, "%.10f", valor);
		size_t largo = strlen(buffer);
		while (buffer[largo-1]=='0') buffer[--largo] = '\0';
		if (buffer[largo-1]=='.') buffer[--largo] = '\0';
	}
	if (strcmp(buffer, "-0")==0) return "0";
	return buffer;
}
