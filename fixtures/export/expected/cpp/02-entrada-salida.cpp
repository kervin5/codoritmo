// Este código fue generado por Codoritmo a partir del pseudocódigo.
// Puede que no sea completamente correcto: revíselo antes de usarlo.

#include<iostream>
#include<cmath>
#include<cstdio>
#include<cstring>
#include<string>
using namespace std;

// cin >> x lee una sola palabra. Para leer una línea completa use getline(cin, x).
// Funciones auxiliares, definidas al final
string convertiratexto(double valor);

int main() {
	int a = 0;
	double b = 0;
	string c;
	bool d = false;
	cin >> a;
	cin >> b;
	cin >> c;
	cin >> d;
	cout << a << endl;
	cout << convertiratexto(b) << endl;
	cout << c << endl;
	cout << (d ? "VERDADERO" : "FALSO") << endl;
	cin >> a >> b >> c >> d;
	cout << a << convertiratexto(b) << c << (d ? "VERDADERO" : "FALSO") << endl;
	cout << "Esta linea no lleva enter al final";
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
