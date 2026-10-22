/* Este código fue generado por Codoritmo a partir del pseudocódigo.
   Puede que no sea completamente correcto: revíselo antes de usarlo. */

#include<stdio.h>
#include<math.h>
#include<stdbool.h>
#include<string.h>

/* Las cadenas son arreglos de char de tamaño MAX_STRLEN (incluido el
   caracter de terminación). */
#define MAX_STRLEN 256
#define MAX_BUFFERS 10
/* scanf("%s", x) lee una sola palabra. Para leer una línea completa use
   fgets(x, MAX_STRLEN, stdin). */
/* Funciones auxiliares, definidas al final */
bool leer_logico(void);
char *convertiratexto(double valor);
char *get_aux_buffer(void);

int main() {
	int a = 0;
	double b = 0;
	char c[MAX_STRLEN] = "";
	bool d = false;
	scanf("%d", &a);
	scanf("%lf", &b);
	scanf("%s", c);
	d = leer_logico();
	printf("%i\n", a);
	printf("%s\n", convertiratexto(b));
	printf("%s\n", c);
	printf("%s\n", d ? "VERDADERO" : "FALSO");
	scanf("%d", &a);
	scanf("%lf", &b);
	scanf("%s", c);
	d = leer_logico();
	printf("%i%s%s%s\n", a, convertiratexto(b), c, d ? "VERDADERO" : "FALSO");
	printf("Esta linea no lleva enter al final");
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

bool leer_logico(void) {
	char palabra[MAX_STRLEN];
	if (scanf("%255s", palabra)!=1) return false;
	return palabra[0]=='v' || palabra[0]=='V' || palabra[0]=='1';
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
