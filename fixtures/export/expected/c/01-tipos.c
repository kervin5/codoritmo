/* Este código fue generado por Codoritmo a partir del pseudocódigo.
   Puede que no sea completamente correcto: revíselo antes de usarlo. */

#include<stdio.h>
#include<stdbool.h>
#include<string.h>

/* Las cadenas son arreglos de char de tamaño MAX_STRLEN (incluido el
   caracter de terminación). */
#define MAX_STRLEN 256
/* No se pudo determinar el tipo de algunas variables: se declaran como
   SIN_TIPO. Reemplácelo por el tipo adecuado (int, double, bool o char[]). */
#define SIN_TIPO double

int main() {
	int a;
	double b;
	bool c;
	bool d;
	char e[MAX_STRLEN];
	char f[MAX_STRLEN];
	SIN_TIPO p;
	a = 1;
	b = 2.5;
	c = true;
	d = false;
	strcpy(e, "Hola");
	strcpy(f, "Hola Mundo");
	scanf("%lf", &p);
	printf("%g\n", p);
	return 0;
}
