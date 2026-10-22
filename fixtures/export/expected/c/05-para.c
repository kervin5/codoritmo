/* Este código fue generado por Codoritmo a partir del pseudocódigo.
   Puede que no sea completamente correcto: revíselo antes de usarlo. */

#include<stdio.h>
#include<math.h>
#include<string.h>

/* Las cadenas son arreglos de char de tamaño MAX_STRLEN (incluido el
   caracter de terminación). */
#define MAX_STRLEN 256
#define MAX_BUFFERS 10
/* Funciones auxiliares, definidas al final */
char *convertiratexto(double valor);
char *get_aux_buffer(void);

int main() {
	int a[10] = {0};
	double b[3][6] = {0};
	double c = 0;
	int i = 0;
	int j = 0;
	for (i=1; i<=10; ++i) {
		a[i-1] = i*10;
	}
	for (int *elemento=&(a[0]); elemento<=&(a[9]); ++elemento) {
		printf("%i\n", (*elemento));
	}
	c = 0;
	for (double *x=&(b[0][0]); x<=&(b[2][5]); ++x) {
		c = c+1;
		(*x) = c;
	}
	for (i=3; i>=1; --i) {
		for (j=1; j<=5; j+=2) {
			printf("%s\n", convertiratexto(b[i-1][j-1]));
		}
	}
	return 0;
}

/* Devuelve uno de varios buffers estáticos, rotando, para guardar
   cadenas temporales (concatenaciones, resultados de funciones). */
char *get_aux_buffer(void) {
	static char buffers[MAX_BUFFERS][MAX_STRLEN];
	static int actual = 0;
	actual = (actual+1)%MAX_BUFFERS;
	buffers[actual][0] = '\0';
	return buffers[actual];
}

/* Escribe un número como PSeInt: redondeado a 10 decimales, sin ceros
   finales y sin notación exponencial. */
char *convertiratexto(double valor) {
	char *buffer = get_aux_buffer();
	int largo;
	if (valor==floor(valor)) {
		snprintf(buffer, MAX_STRLEN, "%.0f", valor);
	} else {
		snprintf(buffer, MAX_STRLEN, "%.10f", valor);
		largo = (int)strlen(buffer);
		while (buffer[largo-1]=='0') buffer[--largo] = '\0';
		if (buffer[largo-1]=='.') buffer[--largo] = '\0';
	}
	if (strcmp(buffer, "-0")==0) strcpy(buffer, "0");
	return buffer;
}
