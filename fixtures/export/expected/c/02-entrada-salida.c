/* Este código fue generado por Codoritmo a partir del pseudocódigo.
   Puede que no sea completamente correcto: revíselo antes de usarlo. */

#include<stdio.h>
#include<stdbool.h>
#include<string.h>

/* Las cadenas son arreglos de char de tamaño MAX_STRLEN (incluido el
   caracter de terminación). */
#define MAX_STRLEN 256
/* scanf("%s", x) lee una sola palabra. Para leer una línea completa use
   fgets(x, MAX_STRLEN, stdin). */
/* Funciones auxiliares, definidas al final */
bool leer_logico(void);

int main() {
	int a;
	double b;
	char c[MAX_STRLEN];
	bool d;
	scanf("%d", &a);
	scanf("%lf", &b);
	scanf("%s", c);
	d = leer_logico();
	printf("%i\n", a);
	printf("%g\n", b);
	printf("%s\n", c);
	printf("%s\n", d ? "VERDADERO" : "FALSO");
	scanf("%d", &a);
	scanf("%lf", &b);
	scanf("%s", c);
	d = leer_logico();
	printf("%i%g%s%s\n", a, b, c, d ? "VERDADERO" : "FALSO");
	printf("Esta linea no lleva enter al final");
	return 0;
}

bool leer_logico(void) {
	char palabra[MAX_STRLEN];
	if (scanf("%255s", palabra)!=1) return false;
	return palabra[0]=='v' || palabra[0]=='V' || palabra[0]=='1';
}
