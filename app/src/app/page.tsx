'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Container,
  VStack,
  HStack,
  Text,
  Heading,
  Button,
  Checkbox,
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardFooter,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  useToast,
  Flex,
  Icon,
  Progress,
  Divider,
  IconButton,
  Tooltip,
} from '@chakra-ui/react';

interface SurveyQuestion {
  question_id: number;
  category: string;
  sub_category: string;
  question: string;
  question_tool_tip: string;
}

interface AnswerOption {
  answer_id: number;
  answer_type: 'radiobutton' | 'checkbox';
  answer: string;
  answer_order: number;
}

interface SurveyData {
  question: SurveyQuestion;
  answers: AnswerOption[];
}

export default function SurveyPage() {
  const [surveyData, setSurveyData] = useState<SurveyData | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();

  useEffect(() => {
    fetchSurveyData();
  }, []);

  const fetchSurveyData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/survey-question');
      if (!response.ok) {
        throw new Error('Failed to fetch survey data');
      }
      const data = await response.json();
      setSurveyData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (answerId: number, isChecked: boolean) => {
    if (surveyData?.question && surveyData.question.sub_category === 'Asset Management') {
      if (isChecked) {
        setSelectedAnswers(prev => [...prev, answerId]);
      } else {
        setSelectedAnswers(prev => prev.filter(id => id !== answerId));
      }
    } else {
      setSelectedAnswers([answerId]);
    }
  };

  const handleSubmit = async () => {
    if (selectedAnswers.length === 0) {
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch('/api/submit-answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question_id: surveyData?.question.question_id,
          selected_answers: selectedAnswers,
        }),
      });

      if (response.ok) {
        toast({
          title: 'Assessment Submitted!',
          description: 'Your security assessment has been successfully recorded.',
          status: 'success',
          duration: 5000,
          isClosable: true,
          position: 'top-right',
        });
        setSelectedAnswers([]);
      } else {
        throw new Error('Failed to submit answer');
      }
    } catch (err) {
      toast({
        title: 'Submission Failed',
        description: 'Error submitting answer: ' + (err instanceof Error ? err.message : 'Unknown error'),
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'top-right',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box minH="100vh" bg="blue.50" display="flex" alignItems="center" justifyContent="center">
        <VStack spacing={6}>
          <Spinner
            thickness="4px"
            speed="0.65s"
            emptyColor="blue.200"
            color="blue.500"
            size="xl"
          />
          <VStack spacing={2}>
            <Heading size="lg" color="gray.700">
              Loading Security Assessment
            </Heading>
            <Text color="gray.500">
              Preparing your cybersecurity evaluation...
            </Text>
          </VStack>
        </VStack>
      </Box>
    );
  }

  if (error) {
    return (
      <Box minH="100vh" bg="blue.50" display="flex" alignItems="center" justifyContent="center" p={4}>
        <Card maxW="md" textAlign="center">
          <CardBody>
            <VStack spacing={6}>
              <Box
                w="20"
                h="20"
                bg="red.100"
                borderRadius="full"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <Text fontSize="4xl">⚠️</Text>
              </Box>
              <VStack spacing={3}>
                <Heading size="lg" color="gray.800">
                  Unable to Load Assessment
                </Heading>
                <Text color="gray.600">{error}</Text>
              </VStack>
              <Button colorScheme="blue" onClick={fetchSurveyData}>
                Try Again
              </Button>
            </VStack>
          </CardBody>
        </Card>
      </Box>
    );
  }

  if (!surveyData) {
    return (
      <Box minH="100vh" bg="blue.50" display="flex" alignItems="center" justifyContent="center">
        <Text color="gray.600">No survey data available</Text>
      </Box>
    );
  }

  return (
    <Box minH="100vh" bg="blue.50" py={8} px={4}>
      <Container maxW="4xl">
        {/* Header */}
        <VStack spacing={8} mb={12} textAlign="center">
          <Box
            w="16"
            h="16"
            bg="blue.500"
            borderRadius="2xl"
            display="flex"
            alignItems="center"
            justifyContent="center"
            boxShadow="xl"
          >
            <Text fontSize="2xl" color="white">🛡️</Text>
          </Box>
          <VStack spacing={4}>
            <Heading size="2xl" color="gray.900">
              NIST CSF Security Assessment
            </Heading>
            <Text fontSize="xl" color="gray.600" maxW="2xl">
              Evaluate your organization's cybersecurity posture with our comprehensive framework assessment
            </Text>
          </VStack>
        </VStack>

        {/* Survey Card */}
        <Card shadow="xl" borderRadius="2xl" border="1px" borderColor="gray.100">
          <CardHeader pb={6}>
            <VStack spacing={4} align="stretch">
              <HStack spacing={3} flexWrap="wrap">
                <Badge colorScheme="blue" variant="subtle" px={3} py={1} borderRadius="full">
                  {surveyData.question.category}
                </Badge>
                <Badge colorScheme="gray" variant="subtle" px={3} py={1} borderRadius="full">
                  {surveyData.question.sub_category}
                </Badge>
              </HStack>
              <Heading size="lg" color="gray.900" lineHeight="tall">
                {surveyData.question.question}
              </Heading>
              {surveyData.question.question_tool_tip && (
                <Alert status="info" borderRadius="lg" borderLeft="4px" borderColor="blue.400">
                  <AlertIcon />
                  <Box>
                    <AlertTitle>Helpful Tip</AlertTitle>
                    <AlertDescription>
                      {surveyData.question.question_tool_tip}
                    </AlertDescription>
                  </Box>
                </Alert>
              )}
            </VStack>
          </CardHeader>

          <CardBody pt={0}>
            <VStack spacing={4} align="stretch" mb={8}>
              {surveyData.answers.map((answer) => (
                <Box
                  key={answer.answer_id}
                  p={4}
                  borderRadius="xl"
                  border="2px"
                  borderColor={selectedAnswers.includes(answer.answer_id) ? "blue.500" : "gray.200"}
                  bg={selectedAnswers.includes(answer.answer_id) ? "blue.50" : "white"}
                  _hover={{
                    borderColor: "blue.300",
                    shadow: "md",
                  }}
                  transition="all 0.2s"
                  cursor="pointer"
                  onClick={() => handleAnswerChange(answer.answer_id, !selectedAnswers.includes(answer.answer_id))}
                >
                  <HStack spacing={4} align="flex-start">
                    <Checkbox
                      isChecked={selectedAnswers.includes(answer.answer_id)}
                      onChange={(e) => handleAnswerChange(answer.answer_id, e.target.checked)}
                      colorScheme="blue"
                      size="lg"
                    />
                    <Text fontSize="lg" fontWeight="medium" color="gray.900" flex={1}>
                      {answer.answer}
                    </Text>
                    <Box
                      w={6}
                      h={6}
                      borderRadius="full"
                      border="2px"
                      borderColor={selectedAnswers.includes(answer.answer_id) ? "blue.500" : "gray.300"}
                      bg={selectedAnswers.includes(answer.answer_id) ? "blue.500" : "transparent"}
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      transition="all 0.2s"
                    >
                      {selectedAnswers.includes(answer.answer_id) && (
                        <Text color="white" fontSize="sm">✓</Text>
                      )}
                    </Box>
                  </HStack>
                </Box>
              ))}
            </VStack>
          </CardBody>

          <CardFooter pt={0}>
            <VStack spacing={6} w="full">
              <Button
                colorScheme="blue"
                size="lg"
                px={8}
                py={6}
                borderRadius="xl"
                fontSize="lg"
                fontWeight="semibold"
                onClick={handleSubmit}
                disabled={selectedAnswers.length === 0 || isSubmitting}
                isLoading={isSubmitting}
                loadingText="Submitting..."
                w="full"
                maxW="md"
              >
                Submit Assessment
              </Button>

              {/* Progress Indicator */}
              <HStack spacing={3} bg="gray.100" px={4} py={2} borderRadius="full">
                <Box w={2} h={2} bg="blue.500" borderRadius="full" />
                <Text fontSize="sm" fontWeight="medium" color="gray.700">
                  Question 1 of 1 • {selectedAnswers.length} answer(s) selected
                </Text>
              </HStack>
            </VStack>
          </CardFooter>
        </Card>

        {/* Footer */}
        <VStack spacing={4} mt={12} textAlign="center">
          <Divider />
          <HStack spacing={2} color="gray.500">
            <Text>🔒</Text>
            <Text fontSize="sm">Powered by NIST Cybersecurity Framework</Text>
          </HStack>
        </VStack>
      </Container>
    </Box>
  );
}
