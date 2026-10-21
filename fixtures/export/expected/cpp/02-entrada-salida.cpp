// Este código fue generado por Codoritmo a partir del pseudocódigo.
// Puede que no sea completamente correcto: revíselo antes de usarlo.

#include<iostream>
#include<string>
using namespace std;

// cin >> x lee una sola palabra. Para leer una línea completa use getline(cin, x).

int main() {
	int a;
	double b;
	string c;
	bool d;
	cin >> a;
	cin >> b;
	cin >> c;
	cin >> d;
	cout << a << endl;
	cout << b << endl;
	cout << c << endl;
	cout << (d ? "VERDADERO" : "FALSO") << endl;
	cin >> a >> b >> c >> d;
	cout << a << b << c << (d ? "VERDADERO" : "FALSO") << endl;
	cout << "Esta linea no lleva enter al final";
	return 0;
}
