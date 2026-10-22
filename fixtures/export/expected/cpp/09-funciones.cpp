// Este código fue generado por Codoritmo a partir del pseudocódigo.
// Puede que no sea completamente correcto: revíselo antes de usarlo.

#include<iostream>
#include<cmath>
#include<cstdlib>
#include<cctype>
#include<cstdio>
#include<cstring>
#include<string>
using namespace std;

// Funciones auxiliares, definidas al final
int redondear(double x);
int truncar(double x);
string convertiratexto(double valor);
string mayusculas(string s);
string minusculas(string s);

int main() {
	string s;
	double x = 0;
	x = 1.5;
	cout << convertiratexto(sqrt(x)) << endl;
	cout << convertiratexto(fabs(x)) << endl;
	cout << convertiratexto(log(x)) << endl;
	cout << convertiratexto(exp(x)) << endl;
	cout << convertiratexto(sin(x)) << endl;
	cout << convertiratexto(cos(x)) << endl;
	cout << convertiratexto(tan(x)) << endl;
	cout << convertiratexto(asin(x)) << endl;
	cout << convertiratexto(acos(x)) << endl;
	cout << convertiratexto(atan(x)) << endl;
	cout << redondear(x) << endl;
	cout << truncar(x) << endl;
	cout << (rand()%15) << endl;
	s = "Hola";
	cout << int(s.size()) << endl;
	cout << minusculas(s) << endl;
	cout << mayusculas(s) << endl;
	cout << s.substr(1, 2) << endl;
	cout << (s+" Mundo") << endl;
	cout << (string("Mundo ")+s) << endl;
	cout << convertiratexto(atof("15.5")) << endl;
	cout << convertiratexto(15.5) << endl;
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

// Las letras acentuadas y la ñ (UTF-8) también cambian.
string mayusculas(string s) {
	for (size_t i=0; i<s.size(); ++i) {
		s[i] = char(toupper((unsigned char)s[i]));
		if ((unsigned char)s[i]==0xC3 && i+1<s.size()) {
			unsigned char c = (unsigned char)s[++i];
			if (c>=0xA0 && c<=0xBE && c!=0xB7) c -= 0x20;
			s[i] = char(c);
		}
	}
	return s;
}

string minusculas(string s) {
	for (size_t i=0; i<s.size(); ++i) {
		s[i] = char(tolower((unsigned char)s[i]));
		if ((unsigned char)s[i]==0xC3 && i+1<s.size()) {
			unsigned char c = (unsigned char)s[++i];
			if (c>=0x80 && c<=0x9E && c!=0x97) c += 0x20;
			s[i] = char(c);
		}
	}
	return s;
}

// Como redon() de PSeInt: redondea alejándose de cero (-2.5 da -3).
int redondear(double x) {
	return (int)(x<0 ? x-0.5 : x+0.5);
}

// Como trunc() de PSeInt: un valor a menos de 1e-11 del entero siguiente
// se trunca a ese entero, así trunc(100*0.57) da 57 y no 56.
int truncar(double x) {
	int t = (int)x;
	if (t+1-x<1e-11) return t+1;
	if (t-1-x>-1e-11) return t-1;
	return t;
}
