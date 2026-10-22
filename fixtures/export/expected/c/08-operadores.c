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
/* Funciones auxiliares, definidas al final */
char *convertiratexto(double valor);
char *get_aux_buffer(void);

int main() {
	double a = 0;
	double b = 0;
	bool c = false;
	bool d = false;
	char e[MAX_STRLEN] = "";
	char f[MAX_STRLEN] = "";
	a = 11;
	b = 2;
	c = true;
	d = false;
	strcpy(e, "Hola");
	strcpy(f, "Mundo");
	printf("%s\n", convertiratexto(a+b));
	printf("%s\n", convertiratexto(a*b));
	printf("%s\n", convertiratexto(a/b));
	printf("%s\n", convertiratexto(a-b));
	printf("%s\n", convertiratexto(pow(a, b)));
	printf("%s\n", convertiratexto(fmod(a, b)));
	printf("%s\n", a==b ? "VERDADERO" : "FALSO");
	printf("%s\n", a!=b ? "VERDADERO" : "FALSO");
	printf("%s\n", a<b ? "VERDADERO" : "FALSO");
	printf("%s\n", a>b ? "VERDADERO" : "FALSO");
	printf("%s\n", a<=b ? "VERDADERO" : "FALSO");
	printf("%s\n", a>=b ? "VERDADERO" : "FALSO");
	printf("%s\n", c && d ? "VERDADERO" : "FALSO");
	printf("%s\n", c || d ? "VERDADERO" : "FALSO");
	printf("%s\n", !(c && d) ? "VERDADERO" : "FALSO");
	printf("%s\n", strcat(strcpy(get_aux_buffer(), strcat(strcpy(get_aux_buffer(), e), " ")), f));
	printf("%s\n", strcmp(e, f)==0 ? "VERDADERO" : "FALSO");
	printf("%s\n", strcmp(e, f)!=0 ? "VERDADERO" : "FALSO");
	printf("%s\n", strcmp(e, f)<0 ? "VERDADERO" : "FALSO");
	printf("%s\n", strcmp(e, f)>0 ? "VERDADERO" : "FALSO");
	printf("%s\n", strcmp(e, f)<=0 ? "VERDADERO" : "FALSO");
	printf("%s\n", strcmp(e, f)>=0 ? "VERDADERO" : "FALSO");
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
